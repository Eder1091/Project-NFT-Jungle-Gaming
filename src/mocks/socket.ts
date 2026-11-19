/**
 * Servidor Socket.IO simulado. O app usa o `socket.io-client` real; aqui o MSW intercepta a conexão
 * WebSocket e o binding decodifica o protocolo. Broadcast e "salas" não existem no binding, então
 * mantemos a lista de clientes conectados manualmente.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '../api/types.ts'
import type { EngineEvents } from './engine.ts'

export const REALTIME_URL = 'wss://realtime.kurio.test'
export const REALTIME_PATH = '/socket.io'

interface Peer { userId: string | null; emit: (event: string, payload: unknown) => void }
const peers = new Set<Peer>()

let resolveToken: (token: string) => string | null = () => null
export function setTokenResolver(fn: (token: string) => string | null) { resolveToken = fn }

const link = ws.link(`${REALTIME_URL}${REALTIME_PATH}/`)

export const socketHandlers = [
  link.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    const peer: Peer = { userId: null, emit: (event, payload) => io.client.emit(event, payload) }
    peers.add(peer)

    io.client.on('subscribe', (payload: unknown) => {
      const token = (payload as { token?: string | null } | undefined)?.token
      peer.userId = token ? resolveToken(token) : null
    })
    connection.client.addEventListener('close', () => peers.delete(peer))
  }),
]

export function broadcastNft(event: NftUpdatedEvent) {
  for (const p of peers) p.emit('nft.updated', event)
}

/** Eventos de pedido só chegam ao dono do pedido. */
export function emitToUser(event: OrderUpdatedEvent) {
  for (const p of peers) if (p.userId === event.userId) p.emit('order.updated', event)
}

export function emitEvents(events: EngineEvents) {
  events.nft.forEach(broadcastNft)
  events.order.forEach(emitToUser)
}

export const connectedPeers = () => peers.size
