/**
 * Motor do "backend" simulado: carrinho, cotação, pedidos idempotentes e eventos em tempo real.
 * Funções puras sobre `Db` (mutam o objeto recebido e devolvem eventos para quem fizer o broadcast).
 */
import type {
  Cart, CartItem, CartItemInput, NftUpdatedEvent, Order, OrderRequest, OrderUpdatedEvent, Quote, WalletKind,
} from '../api/types.ts'
import { addEth } from '../lib/eth.ts'
import { nextId, type Db, type StoredOrder } from './db.ts'
import { ALL_NETWORKS, DomainError, buildQuote, sameEconomics } from './domain.ts'

export const ORDER_SETTLE_MS = 2500
const MAX_QUOTES = 50
const WALLET_LABEL: Record<WalletKind, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }

export interface EngineEvents { nft: NftUpdatedEvent[]; order: OrderUpdatedEvent[] }
export const noEvents = (): EngineEvents => ({ nft: [], order: [] })

/* -------------------------------- Carrinho -------------------------------- */

export const userOwner = (userId: string) => `user:${userId}`
export const anonOwner = (anonId: string) => `anon:${anonId}`

export function getCart(db: Db, owner: string): Cart {
  return db.carts[owner] ?? { items: [], version: 0 }
}

const itemId = (nftId: string, editionId: string) => `ci_${nftId}_${editionId.replace('/', '-')}`

export function upsertCartItem(db: Db, owner: string, input: CartItemInput, mode: 'set' | 'add'): Cart {
  const nft = db.nfts.find((n) => n.id === input.nftId)
  if (!nft) throw new DomainError('not_found', 'NFT não encontrado.')
  const edition = nft.editions.find((e) => e.id === input.editionId)
  if (!edition) throw new DomainError('validation_error', 'Edição inválida.', { fieldErrors: { editionId: 'Edição inválida.' } })
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) {
    throw new DomainError('validation_error', 'Quantidade inválida.', { fieldErrors: { quantity: 'Use um número inteiro de 1 a 99.' } })
  }

  const cart = getCart(db, owner)
  const id = itemId(nft.id, edition.id)
  const existing = cart.items.find((i) => i.id === id)
  const quantity = mode === 'add' ? (existing?.quantity ?? 0) + input.quantity : input.quantity
  if (edition.available !== null && quantity > edition.available) {
    throw new DomainError('availability_conflict', `Apenas ${edition.available} disponível(is) nesta edição.`, { details: { available: edition.available } })
  }

  const next: CartItem = { id, nftId: nft.id, editionId: edition.id, quantity }
  const items = existing ? cart.items.map((i) => (i.id === id ? next : i)) : [...cart.items, next]
  db.carts[owner] = { items, version: cart.version + 1 }
  return db.carts[owner]
}

export function removeCartItem(db: Db, owner: string, id: string): Cart {
  const cart = getCart(db, owner)
  if (!cart.items.some((i) => i.id === id)) return cart
  db.carts[owner] = { items: cart.items.filter((i) => i.id !== id), version: cart.version + 1 }
  return db.carts[owner]
}

/** Move o carrinho de visitante para o do usuário ao entrar (soma quantidades, respeitando o estoque). */
export function mergeCarts(db: Db, from: string, to: string) {
  const source = db.carts[from]
  if (!source || from === to) return
  const target = getCart(db, to)
  const items = [...target.items]
  for (const line of source.items) {
    const nft = db.nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    const current = items.find((i) => i.id === line.id)
    let quantity = (current?.quantity ?? 0) + line.quantity
    if (edition.available !== null) quantity = Math.min(quantity, edition.available)
    if (quantity < 1) continue
    if (current) current.quantity = quantity
    else items.push({ ...line, quantity })
  }
  db.carts[to] = { items, version: target.version + 1 }
  delete db.carts[from]
}

/* -------------------------------- Cotação --------------------------------- */

function storeQuote(db: Db, userId: string, quote: Quote) {
  db.quotes[quote.quoteId] = { userId, quote }
  const ids = Object.keys(db.quotes)
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX_QUOTES))) delete db.quotes[id]
}

export function createQuote(db: Db, owner: string, userId: string, couponCode: string | null | undefined, now: number): Quote {
  const quote = buildQuote({ id: nextId(db, 'qt'), items: getCart(db, owner).items, nfts: db.nfts, couponCode, now })
  storeQuote(db, userId, quote)
  return quote
}

/* ------------------------------- Eventos ---------------------------------- */

function nftEvent(db: Db, nftId: string, now: number): NftUpdatedEvent {
  const nft = db.nfts.find((n) => n.id === nftId)!
  return {
    eventId: nextId(db, 'evt'), resource: 'nft', resourceId: nft.id, version: nft.version,
    emittedAt: new Date(now).toISOString(), data: { priceEth: nft.priceEth, editions: nft.editions },
  }
}

function orderEvent(db: Db, o: StoredOrder, now: number): OrderUpdatedEvent {
  return {
    eventId: nextId(db, 'evt'), resource: 'order', resourceId: o.id, version: o.version, userId: o.userId,
    emittedAt: new Date(now).toISOString(), data: { status: o.status, declineReason: o.declineReason },
  }
}

/** Altera o preço de um NFT (gancho de testes e cenário `price-change`) e devolve o evento. */
export function changePrice(db: Db, nftId: string, priceEth: string, now: number): EngineEvents {
  const nft = db.nfts.find((n) => n.id === nftId)
  if (!nft) throw new DomainError('not_found', 'NFT não encontrado.')
  nft.priceEth = priceEth
  nft.version++
  return { nft: [nftEvent(db, nft.id, now)], order: [] }
}

/* -------------------------------- Pedidos --------------------------------- */

const fakeHash = (n: number) => {
  let h = Math.imul(n, 2654435761) >>> 0
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += h.toString(16).padStart(8, '0')
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0
  }
  return `0x${out.toUpperCase()}`
}

export function toOrder(o: StoredOrder): Order {
  return { id: o.id, status: o.status, version: o.version, createdAt: new Date(o.createdAt).toISOString(), receipt: o.receipt, declineReason: o.declineReason }
}

export function settleOrder(db: Db, o: StoredOrder, now: number, declined: boolean): EngineEvents {
  const events = noEvents()
  if (o.status !== 'pending' || now - o.createdAt < ORDER_SETTLE_MS) return events

  if (declined) {
    o.status = 'declined'
    o.declineReason = 'Pagamento recusado pela carteira.'
    o.version++
    events.order.push(orderEvent(db, o, now))
    return events
  }

  for (const line of o.lines) {
    const nft = db.nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    if (edition.available !== null) edition.available = Math.max(0, edition.available - line.quantity)
    nft.version++
    events.nft.push(nftEvent(db, nft.id, now))
  }
  const cart = db.carts[userOwner(o.userId)]
  if (cart) db.carts[userOwner(o.userId)] = { items: cart.items.filter((i) => !o.lines.some((l) => l.itemId === i.id)), version: cart.version + 1 }

  o.receipt = {
    transactionId: fakeHash(Number(o.id.split('_')[1]) || 1),
    date: new Date(now).toISOString(),
    walletLabel: WALLET_LABEL[o.walletKind],
    lines: o.lines.map((l) => ({
      nftId: l.nftId, name: l.name, tokenId: l.tokenId, image: l.image, editionId: l.editionId,
      quantity: l.quantity, unitPriceEth: l.unitPriceEth, lineTotalEth: l.lineTotalEth,
    })),
    networkFeeEth: o.networkFeeEth,
    totalEth: o.totalEth,
  }
  o.status = 'confirmed'
  o.version++
  events.order.push(orderEvent(db, o, now))
  return events
}

export function readOrder(db: Db, userId: string, orderId: string, now: number, declined: boolean) {
  const o = db.orders[orderId]
  if (!o || o.userId !== userId) throw new DomainError('not_found', 'Pedido não encontrado.')
  const events = settleOrder(db, o, now, declined)
  return { order: o, events }
}

function validateOrderRequest(req: OrderRequest) {
  const fieldErrors: Record<string, string> = {}
  if (!req || typeof req.quoteId !== 'string' || !req.quoteId) fieldErrors.quoteId = 'Cotação ausente.'
  if (!req?.walletId) fieldErrors.walletId = 'Selecione uma carteira.'
  if (!['metamask', 'walletconnect', 'coinbase'].includes(req?.walletKind)) fieldErrors.walletKind = 'Selecione uma carteira.'
  if (!ALL_NETWORKS.includes(req?.network)) fieldErrors.network = 'Selecione uma rede.'
  if (Object.keys(fieldErrors).length) throw new DomainError('validation_error', 'Corrija os campos destacados.', { fieldErrors })
}

export function placeOrder(
  db: Db,
  p: { userId: string; key: string; req: OrderRequest; now: number; bumpPrice?: boolean },
): { order: StoredOrder; created: boolean; events: EngineEvents } {
  if (!p.key) throw new DomainError('validation_error', 'Cabeçalho Idempotency-Key obrigatório.')
  validateOrderRequest(p.req)

  const idemKey = `${p.userId}:${p.key}`
  const existingId = db.idempotency[idemKey]
  if (existingId) {
    const existing = db.orders[existingId]
    if (existing.quoteId !== p.req.quoteId) {
      throw new DomainError('idempotency_conflict', 'Esta chave de idempotência já foi usada com outra cotação.')
    }
    return { order: existing, created: false, events: noEvents() }
  }

  const stored = db.quotes[p.req.quoteId]
  if (!stored || stored.userId !== p.userId || p.now > Date.parse(stored.quote.expiresAt)) {
    throw new DomainError('conflict', 'A cotação expirou. Revise o carrinho e tente novamente.', { details: { reason: 'quote_expired' } })
  }
  if (stored.quote.lines.length === 0) throw new DomainError('validation_error', 'O carrinho está vazio.')

  const events = noEvents()
  if (p.bumpPrice) {
    const first = db.nfts.find((n) => n.id === stored.quote.lines[0].nftId)
    if (first) events.nft.push(...changePrice(db, first.id, addEth(first.priceEth, '0.10'), p.now).nft)
  }

  const fresh = buildQuote({
    id: nextId(db, 'qt'),
    items: stored.quote.lines.map((l) => ({ id: l.itemId, nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })),
    nfts: db.nfts,
    couponCode: stored.quote.couponCode,
    now: p.now,
  })
  const unavailable = fresh.lines.filter((l) => l.unavailable)
  if (unavailable.length) {
    storeQuote(db, p.userId, fresh)
    throw new DomainError('availability_conflict', 'Alguns itens não têm mais estoque suficiente.', {
      details: { quote: fresh, itemIds: unavailable.map((l) => l.itemId) },
    })
  }
  if (!sameEconomics(stored.quote, fresh)) {
    storeQuote(db, p.userId, fresh)
    throw new DomainError('price_changed', 'Os preços mudaram. Revise o novo total antes de confirmar.', { details: { quote: fresh } })
  }

  const order: StoredOrder = {
    id: nextId(db, 'ord'), userId: p.userId, key: p.key, quoteId: p.req.quoteId, status: 'pending', version: 1,
    createdAt: p.now, lines: fresh.lines, networkFeeEth: fresh.networkFeeEth, totalEth: fresh.totalEth,
    walletKind: p.req.walletKind, receipt: null, declineReason: null,
  }
  db.orders[order.id] = order
  db.idempotency[idemKey] = order.id
  return { order, created: true, events }
}
