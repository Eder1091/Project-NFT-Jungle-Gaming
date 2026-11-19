import { http, HttpResponse, delay } from 'msw'
import type {
  ApiErrorCode, CartItemInput, CollectionCategory, LoginInput, Network, NftListQuery, NftSort, NftTab, OrderRequest,
  QuoteRequest, RegisterInput,
} from '../api/types.ts'
import { loginUser, logoutUser, registerUser, resolveSession } from './auth.ts'
import { ALL_CATEGORIES, ALL_NETWORKS, DomainError, listNfts } from './domain.ts'
import {
  anonOwner, createQuote, getCart, mergeCarts, ORDER_SETTLE_MS, placeOrder, readOrder, removeCartItem, settleOrder,
  toOrder, upsertCartItem, userOwner,
} from './engine.ts'
import { commit, getDb } from './runtime.ts'
import { getScenario } from './scenario.ts'
import { emitEvents, setTokenResolver, socketHandlers } from './socket.ts'

const STATUS: Record<ApiErrorCode, number> = {
  validation_error: 422, invalid_credentials: 401, session_invalid: 401, session_expired: 401, forbidden: 403,
  not_found: 404, conflict: 409, availability_conflict: 409, price_changed: 409, coupon_invalid: 422,
  coupon_expired: 422, idempotency_conflict: 422, payment_declined: 402, transient_failure: 503,
}

function fail(e: unknown) {
  if (e instanceof DomainError) {
    return HttpResponse.json({ code: e.code, message: e.message, fieldErrors: e.fieldErrors, details: e.details }, { status: STATUS[e.code] })
  }
  console.error('[mock] erro inesperado', e)
  return HttpResponse.json({ code: 'transient_failure', message: 'Erro inesperado no servidor.' }, { status: 500 })
}

/* ---------------------- latência e falhas por cenário ---------------------- */

const failedOnce = new Set<string>()

async function gate(request: Request): Promise<Response | null> {
  const scenario = getScenario()
  await delay(scenario === 'slow' ? 2000 : 150)
  if (scenario === 'flaky' && request.method === 'GET') {
    const url = new URL(request.url)
    const key = `${request.method} ${url.pathname}${url.search}`
    if (!failedOnce.has(key)) {
      failedOnce.add(key)
      return HttpResponse.json({ code: 'transient_failure', message: 'Instabilidade temporária. Tente novamente.' }, { status: 503 })
    }
  }
  return null
}

interface Ctx { request: Request; params: Record<string, string | readonly string[] | undefined> }

const route = (fn: (ctx: Ctx) => Promise<Response> | Response) => async (ctx: Ctx) => {
  const blocked = await gate(ctx.request)
  if (blocked) return blocked
  try {
    return await fn(ctx)
  } catch (e) {
    return fail(e)
  }
}

const param = (ctx: Ctx, name: string) => {
  const v = ctx.params[name]
  return Array.isArray(v) ? String(v[0]) : String(v ?? '')
}

/* ------------------------------ sessão/dono ------------------------------- */

const bearer = (r: Request) => {
  const h = r.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

function authed(request: Request) {
  try {
    return resolveSession(getDb(), bearer(request), Date.now())
  } catch (e) {
    commit() // resolveSession remove sessões expiradas
    throw e
  }
}

function ownerOf(request: Request) {
  if (bearer(request)) {
    const { user } = authed(request)
    return { owner: userOwner(user.id), userId: user.id as string | null }
  }
  const anon = request.headers.get('x-anon-id')
  if (!anon) throw new DomainError('validation_error', 'Identificador de visitante ausente.')
  return { owner: anonOwner(anon), userId: null as string | null }
}

setTokenResolver((token) => {
  try { return resolveSession(getDb(), token, Date.now()).user.id } catch { return null }
})

const sessionTtl = () => (getScenario() === 'session-expired' ? 3000 : undefined)

const body = async <T,>(request: Request): Promise<T> => {
  try { return (await request.json()) as T } catch { throw new DomainError('validation_error', 'Corpo da requisição inválido.') }
}

/* -------------------------------- catálogo -------------------------------- */

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : undefined)

function parseListQuery(url: URL): NftListQuery {
  const p = url.searchParams
  const category = list(p.get('category'))
  const network = list(p.get('network'))
  const sort = p.get('sort')
  const tab = p.get('tab')
  const fieldErrors: Record<string, string> = {}
  if (category?.some((c) => !ALL_CATEGORIES.includes(c as CollectionCategory))) fieldErrors.category = 'Coleção inválida.'
  if (network?.some((n) => !ALL_NETWORKS.includes(n as Network))) fieldErrors.network = 'Rede inválida.'
  if (sort && !['recent', 'price-asc', 'price-desc', 'rating'].includes(sort)) fieldErrors.sort = 'Ordenação inválida.'
  if (tab && !['all', 'new', 'trending'].includes(tab)) fieldErrors.tab = 'Aba inválida.'
  for (const k of ['minPrice', 'maxPrice'] as const) {
    const v = p.get(k)
    if (v && !/^\d+(\.\d+)?$/.test(v)) fieldErrors[k] = 'Valor inválido.'
  }
  if (Object.keys(fieldErrors).length) throw new DomainError('validation_error', 'Filtros inválidos.', { fieldErrors })
  return {
    q: p.get('q') ?? undefined,
    category: category as CollectionCategory[] | undefined,
    network: network as Network[] | undefined,
    minPrice: p.get('minPrice') ?? undefined,
    maxPrice: p.get('maxPrice') ?? undefined,
    sort: (sort as NftSort | null) ?? undefined,
    tab: (tab as NftTab | null) ?? undefined,
    page: p.get('page') ? Number(p.get('page')) : undefined,
    pageSize: p.get('pageSize') ? Number(p.get('pageSize')) : undefined,
  }
}

const catalog = [
  http.get('/api/nfts', route(({ request }) => {
    const scenario = getScenario()
    if (scenario === 'catalog-error') {
      return HttpResponse.json({ code: 'transient_failure', message: 'Não foi possível carregar o catálogo.' }, { status: 500 })
    }
    const query = parseListQuery(new URL(request.url))
    return HttpResponse.json(listNfts(scenario === 'empty' ? [] : getDb().nfts, query))
  })),

  http.get('/api/nfts/:id', route((ctx) => {
    const nft = getDb().nfts.find((n) => n.id === param(ctx, 'id'))
    if (!nft) throw new DomainError('not_found', 'NFT não encontrado.')
    return HttpResponse.json(nft)
  })),

  http.get('/api/nfts/:id/related', route((ctx) => {
    const id = param(ctx, 'id')
    const nfts = getDb().nfts
    if (!nfts.some((n) => n.id === id)) throw new DomainError('not_found', 'NFT não encontrado.')
    return HttpResponse.json(nfts.filter((n) => n.id !== id).slice(0, 5))
  })),
]

/* ------------------------------- favoritos -------------------------------- */

const favorites = [
  http.get('/api/favorites', route(({ request }) => {
    const { user } = authed(request)
    return HttpResponse.json({ nftIds: getDb().favorites[user.id] ?? [] })
  })),
  http.put('/api/favorites/:nftId', route((ctx) => {
    const { user } = authed(ctx.request)
    const db = getDb()
    const nftId = param(ctx, 'nftId')
    if (!db.nfts.some((n) => n.id === nftId)) throw new DomainError('not_found', 'NFT não encontrado.')
    const set = new Set(db.favorites[user.id] ?? [])
    set.add(nftId)
    db.favorites[user.id] = [...set]
    commit()
    return HttpResponse.json({ nftIds: db.favorites[user.id] })
  })),
  http.delete('/api/favorites/:nftId', route((ctx) => {
    const { user } = authed(ctx.request)
    const db = getDb()
    db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== param(ctx, 'nftId'))
    commit()
    return HttpResponse.json({ nftIds: db.favorites[user.id] })
  })),
]

/* -------------------------------- carrinho -------------------------------- */

const cart = [
  http.get('/api/cart', route(({ request }) => HttpResponse.json(getCart(getDb(), ownerOf(request).owner)))),

  http.post('/api/cart/items', route(async ({ request }) => {
    const { owner } = ownerOf(request)
    const result = upsertCartItem(getDb(), owner, await body<CartItemInput>(request), 'add')
    commit()
    return HttpResponse.json(result)
  })),

  http.put('/api/cart/items', route(async ({ request }) => {
    const { owner } = ownerOf(request)
    const result = upsertCartItem(getDb(), owner, await body<CartItemInput>(request), 'set')
    commit()
    return HttpResponse.json(result)
  })),

  http.delete('/api/cart/items/:id', route((ctx) => {
    const { owner } = ownerOf(ctx.request)
    const result = removeCartItem(getDb(), owner, param(ctx, 'id'))
    commit()
    return HttpResponse.json(result)
  })),

  http.post('/api/cart/quote', route(async ({ request }) => {
    const { owner, userId } = ownerOf(request)
    const input = await body<QuoteRequest>(request)
    const quote = createQuote(getDb(), owner, userId ?? owner, input.couponCode, Date.now())
    commit()
    return HttpResponse.json(quote)
  })),
]

/* --------------------------------- pedidos -------------------------------- */

const consumed = new Set<string>()
const timedOutKeys = new Set<string>()

function scheduleSettle(orderId: string) {
  setTimeout(() => {
    const db = getDb()
    const order = db.orders[orderId]
    if (!order) return
    const events = settleOrder(db, order, Date.now(), getScenario() === 'payment-declined')
    commit()
    emitEvents(events)
  }, ORDER_SETTLE_MS + 50)
}

const orders = [
  http.post('/api/orders', route(async ({ request }) => {
    const { user } = authed(request)
    const db = getDb()
    const key = request.headers.get('idempotency-key') ?? ''
    const scenario = getScenario()

    let result
    try {
      result = placeOrder(db, {
        userId: user.id, key, req: await body<OrderRequest>(request), now: Date.now(),
        bumpPrice: scenario === 'price-change' && !consumed.has('price-change'),
      })
    } catch (e) {
      if (e instanceof DomainError && e.code === 'price_changed') consumed.add('price-change')
      commit() // preços/versões podem ter mudado antes do erro
      throw e
    }
    commit()
    emitEvents(result.events)
    if (result.created) scheduleSettle(result.order.id)

    // Simula timeout: o pedido JÁ foi criado, mas a resposta nunca chega. O retry com a mesma chave reaproveita o pedido.
    if (scenario === 'order-timeout' && !timedOutKeys.has(key)) {
      timedOutKeys.add(key)
      await delay('infinite')
    }
    return HttpResponse.json(toOrder(result.order), { status: result.created ? 201 : 200 })
  })),

  http.get('/api/orders/:id', route((ctx) => {
    const { user } = authed(ctx.request)
    const db = getDb()
    const { order, events } = readOrder(db, user.id, param(ctx, 'id'), Date.now(), getScenario() === 'payment-declined')
    commit()
    emitEvents(events)
    return HttpResponse.json(toOrder(order))
  })),
]

/* ---------------------------------- auth ---------------------------------- */

function mergeAnon(request: Request, userId: string) {
  const anon = request.headers.get('x-anon-id')
  if (anon) mergeCarts(getDb(), anonOwner(anon), userOwner(userId))
}

const auth = [
  http.post('/api/auth/register', route(async ({ request }) => {
    const res = registerUser(getDb(), await body<RegisterInput>(request), Date.now(), sessionTtl())
    mergeAnon(request, res.session.user.id)
    commit()
    return HttpResponse.json(res, { status: 201 })
  })),

  http.post('/api/auth/login', route(async ({ request }) => {
    const res = loginUser(getDb(), await body<LoginInput>(request), Date.now(), sessionTtl())
    mergeAnon(request, res.session.user.id)
    commit()
    return HttpResponse.json(res)
  })),

  http.get('/api/auth/session', route(({ request }) => HttpResponse.json(authed(request).session))),

  http.post('/api/auth/logout', route(({ request }) => {
    logoutUser(getDb(), bearer(request))
    commit()
    return new HttpResponse(null, { status: 204 })
  })),
]

export const handlers = [...catalog, ...favorites, ...cart, ...orders, ...auth, ...socketHandlers]
