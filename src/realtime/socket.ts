/**
 * Camada de tempo real. Toda comunicação passa pelo `socket.io-client` (nunca WebSocket cru) e é
 * exposta à UI como assinaturas tipadas. Eventos duplicados ou antigos são descartados aqui.
 */
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, NftUpdatedEvent, OrderUpdatedEvent, ServerToClientEvents } from '@/api/types'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

type Listener<T> = (event: T) => void

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
let status: RealtimeStatus = 'idle'
let tokenGetter: () => string | null = () => null

const nftListeners = new Set<Listener<NftUpdatedEvent>>()
const orderListeners = new Set<Listener<OrderUpdatedEvent>>()
const statusListeners = new Set<Listener<RealtimeStatus>>()

/** Últimos eventos vistos (deduplicação por eventId) e maior versão por recurso (descarta eventos antigos). */
const seen: string[] = []
const latestVersion = new Map<string, number>()

function fresh(e: { eventId: string; resource: string; resourceId: string; version: number }): boolean {
  if (seen.includes(e.eventId)) return false
  seen.push(e.eventId)
  if (seen.length > 200) seen.shift()
  const key = `${e.resource}:${e.resourceId}`
  if ((latestVersion.get(key) ?? 0) >= e.version) return false
  latestVersion.set(key, e.version)
  return true
}

function setStatus(next: RealtimeStatus) {
  status = next
  statusListeners.forEach((l) => l(next))
}

function subscribe() {
  socket?.emit('subscribe', { token: tokenGetter(), topics: ['nfts', 'orders'] })
}

export function startRealtime(opts: { url: string; path?: string; getToken: () => string | null }) {
  if (socket) return
  tokenGetter = opts.getToken
  setStatus('connecting')
  socket = io(opts.url, {
    path: opts.path ?? '/socket.io',
    transports: ['websocket'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  })
  socket.on('connect', () => { setStatus('connected'); subscribe() })
  socket.on('disconnect', () => setStatus('disconnected'))
  socket.on('connect_error', () => setStatus('disconnected'))
  socket.on('nft.updated', (e) => { if (fresh(e)) nftListeners.forEach((l) => l(e)) })
  socket.on('order.updated', (e) => { if (fresh(e)) orderListeners.forEach((l) => l(e)) })
}

/** Reenvia a assinatura (ex.: depois de login/logout, para trocar o dono dos eventos privados). */
export function refreshSubscription() {
  if (socket?.connected) subscribe()
}

export function stopRealtime() {
  socket?.disconnect()
  socket = null
  setStatus('idle')
}

export const getRealtimeStatus = () => status

const on = <T,>(set: Set<Listener<T>>, l: Listener<T>) => {
  set.add(l)
  return () => { set.delete(l) }
}
export const onNftUpdated = (l: Listener<NftUpdatedEvent>) => on(nftListeners, l)
export const onOrderUpdated = (l: Listener<OrderUpdatedEvent>) => on(orderListeners, l)
export const onRealtimeStatus = (l: Listener<RealtimeStatus>) => on(statusListeners, l)
