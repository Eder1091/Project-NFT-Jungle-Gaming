import { QueryClient } from '@tanstack/react-query'
import { ApiError, isRetryable } from '@/api/client'

/**
 * Política de cache (documentada em ARCHITECTURE.md):
 * - staleTime 30s: listas e detalhes são reaproveitados entre navegações curtas;
 *   eventos Socket.IO e invalidações após mutations cuidam da frescura real.
 * - gcTime 5min: dados saem da memória pouco depois de saírem de uso.
 * - retry: até 2 tentativas, apenas para falhas transitórias (rede/5xx), com backoff exponencial.
 *   4xx (validação, sessão, conflito) nunca repetem.
 * - refetchOnWindowFocus ligado para reconciliar após o usuário voltar à aba.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => failureCount < 2 && isRetryable(error) && !(error instanceof ApiError && error.status < 500),
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}
