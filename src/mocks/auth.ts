import type { AuthResponse, LoginInput, RegisterInput, Session, User } from '../api/types.ts'
import { DomainError } from './domain.ts'
import { nextId, type Db } from './db.ts'

export const SESSION_TTL_MS = 30 * 60_000

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME = /^[a-zA-Z0-9_]{3,20}$/

const randomToken = () => `tok_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`

function openSession(db: Db, user: User, now: number, ttlMs: number): AuthResponse {
  const token = randomToken()
  const expiresAt = now + ttlMs
  db.sessions[token] = { userId: user.id, expiresAt }
  return { token, session: { user, expiresAt: new Date(expiresAt).toISOString() } }
}

export function registerUser(db: Db, input: RegisterInput, now: number, ttlMs = SESSION_TTL_MS): AuthResponse {
  const fieldErrors: Record<string, string> = {}
  if (!USERNAME.test(input.username ?? '')) fieldErrors.username = 'Use de 3 a 20 letras, números ou _.'
  if (!EMAIL.test(input.email ?? '')) fieldErrors.email = 'Digite um e-mail válido.'
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(input.password ?? '')) fieldErrors.password = 'A senha deve ter ao menos 8 caracteres, com letras e números.'
  if (input.password !== input.confirmPassword) fieldErrors.confirmPassword = 'As senhas não conferem.'
  if (Object.keys(fieldErrors).length) throw new DomainError('validation_error', 'Corrija os campos destacados.', { fieldErrors })

  const email = input.email.trim().toLowerCase()
  const username = input.username.trim()
  const taken: Record<string, string> = {}
  if (db.users.some((u) => u.user.email === email)) taken.email = 'Este e-mail já está em uso.'
  if (db.users.some((u) => u.user.username.toLowerCase() === username.toLowerCase())) taken.username = 'Este nome de usuário já está em uso.'
  if (Object.keys(taken).length) throw new DomainError('conflict', 'Já existe uma conta com esses dados.', { fieldErrors: taken })

  const user: User = { id: nextId(db, 'u'), email, username, displayName: username, ensName: null, avatarUrl: null }
  db.users.push({ user, password: input.password })
  return openSession(db, user, now, ttlMs)
}

export function loginUser(db: Db, input: LoginInput, now: number, ttlMs = SESSION_TTL_MS): AuthResponse {
  const fieldErrors: Record<string, string> = {}
  if (!EMAIL.test(input.email ?? '')) fieldErrors.email = 'Digite um e-mail válido.'
  if (!input.password) fieldErrors.password = 'Digite sua senha.'
  if (Object.keys(fieldErrors).length) throw new DomainError('validation_error', 'Corrija os campos destacados.', { fieldErrors })

  const found = db.users.find((u) => u.user.email === input.email.trim().toLowerCase())
  if (!found || found.password !== input.password) throw new DomainError('invalid_credentials', 'E-mail ou senha incorretos.')
  return openSession(db, found.user, now, ttlMs)
}

export function resolveSession(db: Db, token: string | null, now: number): { user: User; session: Session } {
  if (!token) throw new DomainError('session_invalid', 'Faça login para continuar.')
  const s = db.sessions[token]
  if (!s) throw new DomainError('session_invalid', 'Sessão inválida. Entre novamente.')
  if (now >= s.expiresAt) {
    delete db.sessions[token]
    throw new DomainError('session_expired', 'Sua sessão expirou. Entre novamente.')
  }
  const user = db.users.find((u) => u.user.id === s.userId)?.user
  if (!user) throw new DomainError('session_invalid', 'Sessão inválida. Entre novamente.')
  return { user, session: { user, expiresAt: new Date(s.expiresAt).toISOString() } }
}

export function logoutUser(db: Db, token: string | null) {
  if (token) delete db.sessions[token]
}

/** Expira imediatamente todas as sessões (gancho para testes). */
export function expireAllSessions(db: Db, now: number) {
  for (const s of Object.values(db.sessions)) s.expiresAt = now - 1
}
