import type { CollectionCategory, Edition, Network, Nft } from '../api/types.ts'

/** Catálogo determinístico: 36 itens (4 páginas de 9), começando pelos itens dos prints do Figma. */

const BASE_TIME = Date.parse('2026-11-01T12:00:00Z')
const IMG = {
  emerald: '/images/nfts/emerald-ape.webp',
  sage: '/images/nfts/sage-nomad.webp',
  ivory: '/images/nfts/ivory-baron.webp',
  golden: '/images/nfts/golden-beat.webp',
} as const
type ImageKey = keyof typeof IMG

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATEGORIES: CollectionCategory[] = [
  'arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade',
]
const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']

interface Spec {
  name: string
  token: number
  image: ImageKey
  price: string
  previous?: string
  rare?: boolean
  category: CollectionCategory
  network: Network
}

const FIXED: Spec[] = [
  { name: 'Emerald Ape', token: 42, image: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad', token: 9, image: 'sage', price: '1.69', category: 'fotografia', network: 'polygon' },
  { name: 'Neon Vessel', token: 552, image: 'emerald', price: '1.99', previous: '2.29', rare: true, category: 'musica', network: 'solana' },
  { name: 'Cosmic Bloom', token: 118, image: 'sage', price: '1.29', category: 'arte-3d', network: 'ethereum' },
  { name: 'Violet Nomad', token: 314, image: 'sage', price: '1.39', category: 'colecionaveis', network: 'polygon' },
  { name: 'Ivory Baron', token: 88, image: 'ivory', price: '1.79', category: 'generativa', network: 'solana' },
  { name: 'Golden Beat', token: 207, image: 'golden', price: '0.99', category: 'jogos', network: 'ethereum' },
  { name: 'Golden Frequency', token: 71, image: 'golden', price: '0.59', category: 'assinaturas', network: 'polygon' },
  { name: 'Golden Signal', token: 160, image: 'golden', price: '0.39', category: 'utilidade', network: 'solana' },
]

const ADJ = ['Amber', 'Lunar', 'Cobalt', 'Velvet', 'Solar', 'Misty', 'Jade', 'Onyx', 'Crimson']
const NOUN = ['Ape', 'Nomad', 'Baron', 'Bloom', 'Vessel', 'Signal', 'Beat', 'Echo']
const IMAGE_KEYS: ImageKey[] = ['emerald', 'sage', 'ivory', 'golden']

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const pad4 = (n: number) => String(n).padStart(4, '0')
const cents = (c: number) => (c / 100).toFixed(2)
const hex = (rand: () => number, n: number) =>
  Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('').toUpperCase()

function generated(rand: () => number, used: Set<number>): Spec[] {
  const out: Spec[] = []
  for (let i = 0; i < 27; i++) {
    let token = 100 + Math.floor(rand() * 900)
    while (used.has(token)) token = 100 + Math.floor(rand() * 900)
    used.add(token)
    // Garante os extremos do slider de preço do Figma (0,02 e 12,30).
    const c = i === 0 ? 2 : i === 1 ? 1230 : 5 + Math.floor(rand() * 600)
    out.push({
      name: `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`,
      token,
      image: IMAGE_KEYS[i % IMAGE_KEYS.length],
      price: cents(c),
      previous: rand() < 0.15 ? cents(c + 30) : undefined,
      rare: rand() < 0.2,
      category: CATEGORIES[(i + 3) % CATEGORIES.length],
      network: NETWORKS[(i + 1) % NETWORKS.length],
    })
  }
  return out
}

export function buildSeedNfts(): Nft[] {
  const rand = mulberry32(2026)
  const used = new Set(FIXED.map((f) => f.token))
  const specs = [...FIXED, ...generated(rand, used)]

  return specs.map((s, i): Nft => {
    const tokenId = `#${pad4(s.token)}`
    const name = `${s.name} #${String(s.token).padStart(3, '0')}`
    const editions: Edition[] = [
      { id: '1/1', label: '1/1', available: 1 },
      { id: '1/10', label: '1/10', available: i === 0 ? 4 : 3 + Math.floor(rand() * 8) },
      { id: '1/50', label: '1/50', available: i === 0 ? 12 : 10 + Math.floor(rand() * 30) },
      { id: 'aberta', label: 'ABERTA', available: null },
    ]
    const image = IMG[s.image]
    return {
      id: `${slug(s.name)}-${String(s.token).padStart(3, '0')}`,
      tokenId,
      name,
      collection: 'Kurio Apes',
      category: s.category,
      network: s.network,
      priceEth: s.price,
      previousPriceEth: s.previous ?? null,
      rare: s.rare ?? false,
      image,
      gallery: [image, image, image, image],
      description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${labelNetwork(s.network)}, com arte desbloqueável e acesso para colecionadores.`,
      longDescription:
        `${name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.\n\n` +
        'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
      attributes: i === 0 ? ['Óculos', 'Esmeralda', 'Raro'] : [s.rare ? 'Raro' : 'Comum', s.image === 'golden' ? 'Fone' : 'Clássico'],
      editions,
      rating: i === 0 ? { average: 4.8, count: 19 } : { average: Math.round((4.2 + rand() * 0.8) * 10) / 10, count: 3 + Math.floor(rand() * 40) },
      contractAddress: i === 0 ? '0x7A42...19E8' : `0x${hex(rand, 4)}...${hex(rand, 4)}`,
      royaltyPercent: 5,
      listedAt: new Date(BASE_TIME - i * 6 * 3600_000).toISOString(),
      version: 1,
    }
  })
}

function labelNetwork(n: Network): string {
  return n === 'ethereum' ? 'Ethereum' : n === 'polygon' ? 'Polygon' : 'Solana'
}
