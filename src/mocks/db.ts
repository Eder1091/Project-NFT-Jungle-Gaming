import type {
  Cart, Nft, OrderStatus, Quote, QuoteLine, Receipt, User, WalletKind,
} from '../api/types.ts'
import { buildSeedNfts } from './seed.ts'

export const DB_SCHEMA_VERSION = 1
export const DEMO_PASSWORD = 'Kurio@123'

export interface StoredUser { user: User; password: string }
export interface StoredSession { userId: string; expiresAt: number }
export interface StoredQuote { userId: string; quote: Quote }
export interface StoredOrder {
  id: string
  userId: string
  key: string
  quoteId: string
  status: OrderStatus
  version: number
  createdAt: number
  lines: QuoteLine[]
  networkFeeEth: string
  totalEth: string
  walletKind: WalletKind
  receipt: Receipt | null
  declineReason: string | null
}

/** Estado completo do "backend" simulado. Serializável em JSON (persistido no localStorage no navegador). */
export interface Db {
  schemaVersion: number
  seq: number
  nfts: Nft[]
  users: StoredUser[]
  sessions: Record<string, StoredSession>
  /** Chave do dono: `user:<id>` (logado) ou `anon:<id>` (visitante). Nunca compartilhada entre donos. */
  carts: Record<string, Cart>
  favorites: Record<string, string[]>
  quotes: Record<string, StoredQuote>
  orders: Record<string, StoredOrder>
  /** `<userId>:<Idempotency-Key>` -> orderId */
  idempotency: Record<string, string>
}

export function createDb(): Db {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    seq: 100,
    nfts: buildSeedNfts(),
    users: [
      { user: { id: 'u_1', email: 'colecionador@kurio.test', username: 'colecionador', displayName: 'Colecionador Demo', ensName: null, avatarUrl: null }, password: DEMO_PASSWORD },
      { user: { id: 'u_2', email: 'outro@kurio.test', username: 'outro', displayName: 'Outro Colecionador', ensName: null, avatarUrl: null }, password: DEMO_PASSWORD },
    ],
    sessions: {},
    carts: {},
    favorites: {},
    quotes: {},
    orders: {},
    idempotency: {},
  }
}

export function hydrateDb(raw: string | null): Db {
  if (!raw) return createDb()
  try {
    const parsed = JSON.parse(raw) as Db
    return parsed.schemaVersion === DB_SCHEMA_VERSION ? parsed : createDb()
  } catch {
    return createDb()
  }
}

export const serializeDb = (db: Db) => JSON.stringify(db)
export const nextId = (db: Db, prefix: string) => `${prefix}_${++db.seq}`
