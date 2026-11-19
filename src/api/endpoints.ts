import { api } from './client'
import type {
  AuthResponse, Cart, CartItemInput, Favorites, LoginInput, Nft, NftListQuery, Order, OrderRequest, Paginated,
  Quote, QuoteRequest, RegisterInput, Session,
} from './types'

const csv = (v?: readonly string[]) => (v && v.length ? v.join(',') : undefined)

/** Converte filtros em parâmetros de URL, omitindo o que está vazio. */
export function listParams(q: NftListQuery) {
  return {
    q: q.q || undefined,
    category: csv(q.category),
    network: csv(q.network),
    minPrice: q.minPrice || undefined,
    maxPrice: q.maxPrice || undefined,
    sort: q.sort && q.sort !== 'recent' ? q.sort : undefined,
    tab: q.tab && q.tab !== 'all' ? q.tab : undefined,
    page: q.page && q.page > 1 ? q.page : undefined,
    pageSize: q.pageSize,
  }
}

export const fetchNfts = (q: NftListQuery, signal?: AbortSignal) =>
  api.get<Paginated<Nft>>('/nfts', { params: listParams(q), signal }).then((r) => r.data)
export const fetchNft = (id: string, signal?: AbortSignal) => api.get<Nft>(`/nfts/${id}`, { signal }).then((r) => r.data)
export const fetchRelated = (id: string, signal?: AbortSignal) => api.get<Nft[]>(`/nfts/${id}/related`, { signal }).then((r) => r.data)

export const fetchFavorites = () => api.get<Favorites>('/favorites').then((r) => r.data)
export const addFavorite = (nftId: string) => api.put<Favorites>(`/favorites/${nftId}`).then((r) => r.data)
export const removeFavorite = (nftId: string) => api.delete<Favorites>(`/favorites/${nftId}`).then((r) => r.data)

export const fetchCart = () => api.get<Cart>('/cart').then((r) => r.data)
export const addCartItem = (input: CartItemInput) => api.post<Cart>('/cart/items', input).then((r) => r.data)
export const setCartItem = (input: CartItemInput) => api.put<Cart>('/cart/items', input).then((r) => r.data)
export const removeCartItem = (itemId: string) => api.delete<Cart>(`/cart/items/${itemId}`).then((r) => r.data)
export const fetchQuote = (input: QuoteRequest) => api.post<Quote>('/cart/quote', input).then((r) => r.data)

/** `idempotencyKey` deve ser gerada uma vez por tentativa de compra e reutilizada em retries. */
export const createOrder = (input: OrderRequest, idempotencyKey: string) =>
  api.post<Order>('/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } }).then((r) => r.data)
export const fetchOrder = (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data)

export const login = (input: LoginInput) => api.post<AuthResponse>('/auth/login', input).then((r) => r.data)
export const register = (input: RegisterInput) => api.post<AuthResponse>('/auth/register', input).then((r) => r.data)
export const fetchSession = () => api.get<Session>('/auth/session').then((r) => r.data)
export const logout = () => api.post('/auth/logout').then(() => undefined)
