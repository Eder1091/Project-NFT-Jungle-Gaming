import { setupWorker } from 'msw/browser'
import { expireAllSessions } from './auth.ts'
import { changePrice } from './engine.ts'
import { handlers } from './handlers.ts'
import { commit, getDb, resetDb } from './runtime.ts'
import { SCENARIOS, getScenario, initScenario, isScenario, setScenario, type Scenario } from './scenario.ts'
import { connectedPeers, emitEvents } from './socket.ts'

export const worker = setupWorker(...handlers)

/** Controles para testes e demonstração: `window.__mock` no console do navegador. */
export interface MockControls {
  scenarios: readonly Scenario[]
  getScenario: () => Scenario
  setScenario: (s: string) => void
  /** Zera o banco simulado e recarrega a página. */
  reset: () => void
  /** Muda o preço de um NFT e emite `nft.updated` pelo Socket.IO simulado. */
  changePrice: (nftId: string, priceEth: string) => void
  /** Faz a sessão atual expirar agora (próxima chamada privada responde 401 session_expired). */
  expireSessions: () => void
  connectedPeers: () => number
}

declare global {
  interface Window { __mock?: MockControls }
}

export function installMockControls(envScenario?: string) {
  initScenario(envScenario)
  window.__mock = {
    scenarios: SCENARIOS,
    getScenario,
    setScenario: (s) => { if (!isScenario(s)) throw new Error(`Cenário inválido: ${s}`); setScenario(s) },
    reset: () => { resetDb(); window.location.reload() },
    changePrice: (nftId, priceEth) => {
      const events = changePrice(getDb(), nftId, priceEth, Date.now())
      commit()
      emitEvents(events)
    },
    expireSessions: () => { expireAllSessions(getDb(), Date.now()); commit() },
    connectedPeers,
  }
}
