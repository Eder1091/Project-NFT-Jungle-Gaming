import type { NftListQuery } from './types'

/** Chaves de cache centralizadas. Mudou o filtro, mudou a chave: não há estado "manual" de cache. */
export const keys = {
  nfts: (q: NftListQuery) => ['nfts', q] as const,
  nftsAll: ['nfts'] as const,
  nft: (id: string) => ['nft', id] as const,
  related: (id: string) => ['nft', id, 'related'] as const,
  favorites: ['favorites'] as const,
  cart: ['cart'] as const,
  quote: (coupon: string | null) => ['quote', coupon] as const,
  order: (id: string) => ['order', id] as const,
  session: ['session'] as const,
}
