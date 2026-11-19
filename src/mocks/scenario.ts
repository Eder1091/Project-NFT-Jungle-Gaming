/**
 * Cenários de simulação. Escolha por (maior prioridade primeiro):
 *   1. ?mock-scenario=<nome> na URL (fica salvo na sessão da aba)
 *   2. sessionStorage
 *   3. VITE_MOCK_SCENARIO
 * Também é possível trocar em runtime: window.__mock.setScenario('slow').
 */
export const SCENARIOS = [
  'default',          // tudo funciona, latência baixa
  'empty',            // catálogo vazio
  'slow',             // toda requisição demora ~2s
  'flaky',            // 1ª tentativa de cada GET falha com 503 (o retry recupera)
  'catalog-error',    // catálogo sempre falha (testa estado de erro + "tentar de novo")
  'session-expired',  // sessão dura 3s após o login
  'price-change',     // preço muda no 1º envio do pedido (409 price_changed)
  'payment-declined', // pedido termina como recusado
  'order-timeout',    // 1ª tentativa de POST /orders nunca responde (o pedido é criado; o retry reaproveita)
] as const

export type Scenario = (typeof SCENARIOS)[number]

const KEY = 'kurio-mock-scenario'
export const isScenario = (v: unknown): v is Scenario => typeof v === 'string' && (SCENARIOS as readonly string[]).includes(v)

let current: Scenario = 'default'

export function initScenario(envDefault?: string) {
  let fromUrl: string | null = null
  let stored: string | null = null
  try { fromUrl = new URLSearchParams(window.location.search).get('mock-scenario') } catch { /* sem window */ }
  try { stored = sessionStorage.getItem(KEY) } catch { /* storage indisponível */ }
  const pick = [fromUrl, stored, envDefault].find(isScenario)
  current = pick ?? 'default'
  if (isScenario(fromUrl)) setScenario(fromUrl)
}

export const getScenario = (): Scenario => current

export function setScenario(s: Scenario) {
  current = s
  try { sessionStorage.setItem(KEY, s) } catch { /* ignora */ }
}
