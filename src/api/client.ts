import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from './types'

export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message)
    this.name = 'ApiError'
  }
  get code() { return this.body.code }
}

/** Erro sem resposta do servidor (timeout, conexão caída). Considerado transitório. */
export class NetworkError extends Error {
  constructor(message = 'Não foi possível conectar ao servidor.') {
    super(message)
    this.name = 'NetworkError'
  }
}

/** Callback registrado pela camada de sessão para reagir a 401. */
let onUnauthorized: ((code: ApiErrorBody['code']) => void) | null = null
export const setUnauthorizedHandler = (fn: typeof onUnauthorized) => { onUnauthorized = fn }

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.data?.code) {
      const err = new ApiError(error.response.status, error.response.data)
      if (error.response.status === 401) onUnauthorized?.(err.code)
      return Promise.reject(err)
    }
    if (error.response) {
      return Promise.reject(new ApiError(error.response.status, { code: 'transient_failure', message: 'Erro inesperado no servidor.' }))
    }
    if (axios.isCancel(error)) return Promise.reject(error)
    return Promise.reject(new NetworkError())
  },
)

/** Erros que fazem sentido repetir automaticamente (política de retry do TanStack Query). */
export function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true
  if (error instanceof ApiError) return error.status >= 500 || error.code === 'transient_failure'
  return false
}
