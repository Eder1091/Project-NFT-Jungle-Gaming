/**
 * Regras de negócio puras do marketplace simulado (sem MSW, sem DOM): catálogo, cotação e cupons.
 * Rodam no navegador (handlers) e no Node (testes unitários).
 */
import type {
  ApiErrorCode, CartItem, CollectionCategory, Network, Nft, NftListQuery, Paginated, Quote, QuoteLine,
} from '../api/types.ts'
import { addEth, compareEth, mulEth, percentEth, subEth, sumEth } from '../lib/eth.ts'

export const NETWORK_FEE = '0.016'
export const QUOTE_TTL_MS = 10 * 60_000

/** Cupons de demonstração. */
export const COUPONS: Record<string, { percent: number; expired?: boolean }> = {
  KURIO10: { percent: 10 },
  GENESIS20: { percent: 20 },
  OLD2025: { percent: 15, expired: true },
}

export class DomainError extends Error {
  code: ApiErrorCode
  details?: Record<string, unknown>
  fieldErrors?: Record<string, string>
  constructor(code: ApiErrorCode, message: string, extra?: { details?: Record<string, unknown>; fieldErrors?: Record<string, string> }) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.details = extra?.details
    this.fieldErrors = extra?.fieldErrors
  }
}

/* ------------------------------ Catálogo ------------------------------ */

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

type FilterSkip = 'category' | 'network' | 'none'

function applyFilters(items: Nft[], q: NftListQuery, skip: FilterSkip): Nft[] {
  const text = q.q ? fold(q.q.trim()) : ''
  return items.filter((n) => {
    if (text && !fold(`${n.name} ${n.tokenId} ${n.collection}`).includes(text)) return false
    if (skip !== 'category' && q.category?.length && !q.category.includes(n.category)) return false
    if (skip !== 'network' && q.network?.length && !q.network.includes(n.network)) return false
    if (q.minPrice && compareEth(n.priceEth, q.minPrice) < 0) return false
    if (q.maxPrice && compareEth(n.priceEth, q.maxPrice) > 0) return false
    return true
  })
}

const byRecent = (a: Nft, b: Nft) => Date.parse(b.listedAt) - Date.parse(a.listedAt)

/** Aplica a aba (novos = 18 mais recentes; em alta = mais avaliados). */
function applyTab(items: Nft[], tab: NftListQuery['tab'], all: Nft[]): Nft[] {
  if (tab === 'new') {
    const newest = new Set([...all].sort(byRecent).slice(0, 18).map((n) => n.id))
    return items.filter((n) => newest.has(n.id))
  }
  return items
}

const countBy = <K extends string>(items: Nft[], keys: readonly K[], pick: (n: Nft) => K) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  for (const n of items) out[pick(n)]++
  return out
}

export const ALL_CATEGORIES: readonly CollectionCategory[] = [
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade',
]
export const ALL_NETWORKS: readonly Network[] = ['ethereum', 'polygon', 'solana']

export function listNfts(all: Nft[], q: NftListQuery): Paginated<Nft> {
  const pageSize = Math.min(Math.max(q.pageSize ?? 9, 1), 48)
  let items = applyTab(applyFilters(all, q, 'none'), q.tab, all)

  switch (q.sort ?? 'recent') {
    case 'price-asc': items = [...items].sort((a, b) => compareEth(a.priceEth, b.priceEth) || byRecent(a, b)); break
    case 'price-desc': items = [...items].sort((a, b) => compareEth(b.priceEth, a.priceEth) || byRecent(a, b)); break
    case 'rating': items = [...items].sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count); break
    default: items = [...items].sort(byRecent)
  }
  if (q.tab === 'trending') items = [...items].sort((a, b) => b.rating.count - a.rating.count || byRecent(a, b))

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(Math.max(q.page ?? 1, 1), totalPages)

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
    facets: {
      category: countBy(applyTab(applyFilters(all, q, 'category'), q.tab, all), ALL_CATEGORIES, (n) => n.category),
      network: countBy(applyTab(applyFilters(all, q, 'network'), q.tab, all), ALL_NETWORKS, (n) => n.network),
    },
  }
}

/* ------------------------------ Cotação ------------------------------ */

export function buildQuote(input: {
  id: string
  items: Pick<CartItem, 'id' | 'nftId' | 'editionId' | 'quantity'>[]
  nfts: Nft[]
  couponCode?: string | null
  now: number
}): Quote {
  const lines: QuoteLine[] = []
  for (const item of input.items) {
    const nft = input.nfts.find((n) => n.id === item.nftId)
    if (!nft) continue
    const edition = nft.editions.find((e) => e.id === item.editionId)
    const available = edition ? edition.available : 0
    lines.push({
      itemId: item.id,
      nftId: nft.id,
      editionId: item.editionId,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      unitPriceEth: nft.priceEth,
      quantity: item.quantity,
      lineTotalEth: mulEth(nft.priceEth, item.quantity),
      available,
      unavailable: available !== null && item.quantity > available,
    })
  }

  const subtotalEth = sumEth(lines.map((l) => l.lineTotalEth))
  const couponCode = input.couponCode ? input.couponCode.trim().toUpperCase() : null
  let discountEth = '0'
  if (couponCode) {
    const coupon = COUPONS[couponCode]
    if (!coupon) throw new DomainError('coupon_invalid', 'Código promocional inválido.')
    if (coupon.expired) throw new DomainError('coupon_expired', 'Este código promocional expirou.')
    discountEth = percentEth(subtotalEth, coupon.percent)
  }
  const networkFeeEth = lines.length > 0 ? NETWORK_FEE : '0'
  const totalEth = addEth(subEth(subtotalEth, discountEth), networkFeeEth)

  return {
    quoteId: input.id,
    lines,
    subtotalEth,
    discountEth,
    networkFeeEth,
    totalEth,
    couponCode,
    expiresAt: new Date(input.now + QUOTE_TTL_MS).toISOString(),
  }
}

/** Duas cotações são equivalentes quando preços, quantidades e totais coincidem. */
export function sameEconomics(a: Quote, b: Quote): boolean {
  if (a.totalEth !== b.totalEth || a.lines.length !== b.lines.length) return false
  return a.lines.every((l, i) => {
    const o = b.lines[i]
    return o && l.nftId === o.nftId && l.editionId === o.editionId && l.quantity === o.quantity && l.unitPriceEth === o.unitPriceEth
  })
}
