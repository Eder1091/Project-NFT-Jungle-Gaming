/** Token de sessão e identificador de visitante. Tolerante a storage indisponível (modo privado, etc.). */
const TOKEN_KEY = 'kurio.token'
const ANON_KEY = 'kurio.anon'

const memory = new Map<string, string>()

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return memory.get(key) ?? null }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    if (value === null) memory.delete(key)
    else memory.set(key, value)
  }
}

export const getToken = () => read(TOKEN_KEY)
export const setToken = (token: string | null) => write(TOKEN_KEY, token)

/** Identifica o carrinho do visitante antes do login. */
export function getAnonId(): string {
  let id = read(ANON_KEY)
  if (!id) {
    id = crypto.randomUUID()
    write(ANON_KEY, id)
  }
  return id
}
