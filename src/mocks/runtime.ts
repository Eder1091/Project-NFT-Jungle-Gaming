import { createDb, hydrateDb, serializeDb, type Db } from './db.ts'

const STORAGE_KEY = 'kurio-mock-db-v1'
let db: Db | null = null

const read = () => { try { return localStorage.getItem(STORAGE_KEY) } catch { return null } }

/** Banco simulado persistente (localStorage): sobrevive a recarregamentos da página. */
export function getDb(): Db {
  if (!db) db = hydrateDb(read())
  return db
}

/** Persiste o estado depois de qualquer escrita. */
export function commit() {
  try { localStorage.setItem(STORAGE_KEY, serializeDb(getDb())) } catch { /* sem persistência: segue em memória */ }
}

export function resetDb() {
  db = createDb()
  commit()
}
