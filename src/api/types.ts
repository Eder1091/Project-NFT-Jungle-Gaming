/**
 * Contratos tipados da API simulada. Fonte única para transporte (Axios/MSW), estado (TanStack Query) e UI.
 * Valores em ETH sempre como string decimal; quantidades sempre inteiras.
 */
import type { EthString } from '../lib/eth.ts'

export type { EthString }

/* ---------- Erros ---------- */
export type ApiErrorCode =
  | 'validation_error'
  | 'invalid_credentials'
  | 'session_invalid'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'availability_conflict'
  | 'price_changed'
  | 'coupon_invalid'
  | 'coupon_expired'
  | 'idempotency_conflict'
  | 'payment_declined'
  | 'transient_failure'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  /** Erros por campo (formulários). Chave = nome do campo. */
  fieldErrors?: Record<string, string>
  /** Dados extras para conflitos (ex.: nova cotação, estoque disponível). */
  details?: Record<string, unknown>
}

/* ---------- Conta e sessão ---------- */
export interface User {
  id: string
  email: string
  username: string
  displayName: string
  ensName: string | null
  avatarUrl: string | null
}

export interface Session {
  user: User
  /** ISO 8601. Após esse instante, chamadas privadas respondem 401 `session_expired`. */
  expiresAt: string
}

export interface AuthResponse { session: Session; token: string }

export interface RegisterInput { username: string; email: string; password: string; confirmPassword: string }
export interface LoginInput { email: string; password: string }

/* ---------- NFTs ---------- */
export type CollectionCategory =
  | 'arte-digital' | 'fotografia' | 'musica' | 'arte-3d' | 'colecionaveis'
  | 'generativa' | 'jogos' | 'assinaturas' | 'utilidade'
export type Network = 'ethereum' | 'polygon' | 'solana'
export type EditionId = '1/1' | '1/10' | '1/50' | 'aberta'

export interface Edition {
  id: EditionId
  label: string
  /** Unidades disponíveis. `null` = ilimitado (edição aberta). */
  available: number | null
}

export interface Nft {
  id: string
  tokenId: string // "#0042"
  name: string
  collection: string
  category: CollectionCategory
  network: Network
  priceEth: EthString
  /** Preço anterior (exibido riscado). */
  previousPriceEth: EthString | null
  rare: boolean
  image: string
  gallery: string[]
  description: string
  longDescription: string
  attributes: string[]
  editions: Edition[]
  rating: { average: number; count: number }
  contractAddress: string
  royaltyPercent: number
  listedAt: string
  /** Incrementa a cada alteração (preço/disponibilidade). Usado para ignorar eventos antigos. */
  version: number
}

export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'rating'
export type NftTab = 'all' | 'new' | 'trending'

export interface NftListQuery {
  q?: string
  category?: CollectionCategory[]
  network?: Network[]
  minPrice?: EthString
  maxPrice?: EthString
  sort?: NftSort
  tab?: NftTab
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  /** Contagens por faceta para a sidebar (respeitando os demais filtros). */
  facets: { category: Record<CollectionCategory, number>; network: Record<Network, number> }
}

/* ---------- Favoritos ---------- */
export interface Favorites { nftIds: string[] }

/* ---------- Carrinho e cotação ---------- */
export interface CartItemInput { nftId: string; editionId: EditionId; quantity: number }
export interface CartItem extends CartItemInput { id: string }
export interface Cart { items: CartItem[]; version: number }

export interface QuoteLine {
  itemId: string
  nftId: string
  editionId: EditionId
  name: string
  tokenId: string
  image: string
  unitPriceEth: EthString
  quantity: number
  lineTotalEth: EthString
  available: number | null
  /** Quantidade pedida acima do disponível. */
  unavailable: boolean
}

export interface Quote {
  /** Identifica a cotação. O pedido só é aceito com a cotação vigente. */
  quoteId: string
  lines: QuoteLine[]
  subtotalEth: EthString
  discountEth: EthString
  networkFeeEth: EthString
  totalEth: EthString
  couponCode: string | null
  expiresAt: string
}

export interface QuoteRequest { couponCode?: string | null }

/* ---------- Carteiras e perfil ---------- */
export type WalletKind = 'metamask' | 'walletconnect' | 'coinbase'
export interface Wallet {
  id: string
  role: 'primary' | 'secondary'
  displayName: string
  nickname: string
  network: Network
  address: string // 0x...
  ensOrSecondary: string | null
  kind: WalletKind
  email: string
  profileName: string
  referralCode: string
  ensName: string | null
}
export type WalletInput = Omit<Wallet, 'id' | 'role'>

export interface ProfileUpdate { displayName: string; username: string; email: string; ensName: string | null; walletNickname: string }
export interface PasswordChange { currentPassword: string; newPassword: string; confirmNewPassword: string }

/* ---------- Pedidos ---------- */
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface OrderRequest {
  quoteId: string
  walletId: string
  walletKind: WalletKind
  network: Network
  collectorNote?: string
}

export interface ReceiptLine {
  nftId: string
  name: string
  tokenId: string
  image: string
  editionId: EditionId
  quantity: number
  unitPriceEth: EthString
  lineTotalEth: EthString
}

/** Snapshot imutável: alterações posteriores no catálogo não mudam o recibo. */
export interface Receipt {
  transactionId: string
  date: string
  walletLabel: string
  lines: ReceiptLine[]
  networkFeeEth: EthString
  totalEth: EthString
}

export interface Order {
  id: string
  status: OrderStatus
  version: number
  createdAt: string
  receipt: Receipt | null
  declineReason: string | null
}

/* ---------- Socket.IO ---------- */
export interface BaseEvent { eventId: string; resource: string; resourceId: string; version: number; emittedAt: string }

export interface NftUpdatedEvent extends BaseEvent {
  resource: 'nft'
  data: { priceEth: EthString; editions: Edition[] }
}
export interface OrderUpdatedEvent extends BaseEvent {
  resource: 'order'
  /** Eventos só valem para o usuário dono do pedido. */
  userId: string
  data: { status: OrderStatus; declineReason: string | null }
}

export interface ServerToClientEvents {
  'nft.updated': (e: NftUpdatedEvent) => void
  'order.updated': (e: OrderUpdatedEvent) => void
}
export interface ClientToServerEvents {
  /** `token` identifica o usuário para eventos privados (pedidos). Anônimo = `null`. */
  subscribe: (payload: { token: string | null; topics: string[] }) => void
}
