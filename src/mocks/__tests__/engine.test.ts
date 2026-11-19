import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDb } from '../db.ts'
import { listNfts, DomainError } from '../domain.ts'
import {
  anonOwner, changePrice, createQuote, getCart, mergeCarts, ORDER_SETTLE_MS, placeOrder, readOrder,
  removeCartItem, upsertCartItem, userOwner,
} from '../engine.ts'
import { loginUser, registerUser, resolveSession } from '../auth.ts'
import type { OrderRequest } from '../../api/types.ts'

const T0 = Date.parse('2026-11-19T12:00:00Z')
const req = (quoteId: string): OrderRequest => ({ quoteId, walletId: 'w_1', walletKind: 'metamask', network: 'ethereum' })
const code = (fn: () => unknown) => { try { fn() } catch (e) { return e instanceof DomainError ? e.code : 'other:' + String(e) } return 'no-error' }

/** Reproduz o carrinho do Figma desktop: Emerald x2, Violet x6, Ivory x9. */
function figmaCart() {
  const db = createDb()
  const owner = userOwner('u_1')
  upsertCartItem(db, owner, { nftId: 'emerald-ape-042', editionId: '1/50', quantity: 2 }, 'set')
  upsertCartItem(db, owner, { nftId: 'violet-nomad-314', editionId: 'aberta', quantity: 6 }, 'set')
  upsertCartItem(db, owner, { nftId: 'ivory-baron-088', editionId: 'aberta', quantity: 9 }, 'set')
  return { db, owner }
}

test('catálogo: 36 itens, 4 páginas de 9, faixa de preço do Figma', () => {
  const { nfts } = createDb()
  const p1 = listNfts(nfts, {})
  assert.equal(p1.totalItems, 36)
  assert.equal(p1.totalPages, 4)
  assert.equal(p1.items.length, 9)
  assert.equal(p1.items[0].name, 'Emerald Ape #042')
  const prices = nfts.map((n) => Number(n.priceEth))
  assert.equal(Math.min(...prices), 0.02)
  assert.equal(Math.max(...prices), 12.3)
  assert.equal(new Set(nfts.map((n) => n.id)).size, 36)
})

test('catálogo: filtros, ordenação, facetas e página fora do intervalo', () => {
  const { nfts } = createDb()
  const arte = listNfts(nfts, { category: ['arte-digital'] })
  assert.ok(arte.items.every((n) => n.category === 'arte-digital'))
  // faceta de categoria ignora o filtro de categoria (para a sidebar mostrar as outras opções)
  assert.equal(arte.facets.category.fotografia > 0, true)
  const asc = listNfts(nfts, { sort: 'price-asc', pageSize: 48 }).items.map((n) => Number(n.priceEth))
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b))
  assert.equal(listNfts(nfts, { q: 'EMERALD' }).items[0].id, 'emerald-ape-042')
  assert.equal(listNfts(nfts, { q: 'zzzz' }).totalItems, 0)
  assert.equal(listNfts(nfts, { minPrice: '1.00', maxPrice: '1.50' }).items.every((n) => Number(n.priceEth) >= 1 && Number(n.priceEth) <= 1.5), true)
  assert.equal(listNfts(nfts, { page: 99 }).page, 4)
})

test('cotação: bate com os valores do Figma (26.83 / 26.846)', () => {
  const { db, owner } = figmaCart()
  const q = createQuote(db, owner, 'u_1', null, T0)
  assert.deepEqual(q.lines.map((l) => l.lineTotalEth), ['2.38', '8.34', '16.11'])
  assert.equal(q.subtotalEth, '26.83')
  assert.equal(q.discountEth, '0')
  assert.equal(q.networkFeeEth, '0.016')
  assert.equal(q.totalEth, '26.846')
})

test('cupons: válido, inválido e expirado', () => {
  const { db, owner } = figmaCart()
  const q = createQuote(db, owner, 'u_1', 'kurio10', T0)
  assert.equal(q.discountEth, '2.683')
  assert.equal(q.totalEth, '24.163')
  assert.equal(code(() => createQuote(db, owner, 'u_1', 'NOPE', T0)), 'coupon_invalid')
  assert.equal(code(() => createQuote(db, owner, 'u_1', 'OLD2025', T0)), 'coupon_expired')
})

test('carrinho: validações, estoque e remoção', () => {
  const db = createDb()
  const o = userOwner('u_1')
  assert.equal(code(() => upsertCartItem(db, o, { nftId: 'emerald-ape-042', editionId: '1/50', quantity: 0 }, 'set')), 'validation_error')
  assert.equal(code(() => upsertCartItem(db, o, { nftId: 'emerald-ape-042', editionId: '1/50', quantity: 1.5 }, 'set')), 'validation_error')
  assert.equal(code(() => upsertCartItem(db, o, { nftId: 'emerald-ape-042', editionId: '1/1', quantity: 2 }, 'set')), 'availability_conflict')
  assert.equal(code(() => upsertCartItem(db, o, { nftId: 'nao-existe', editionId: '1/1', quantity: 1 }, 'set')), 'not_found')
  upsertCartItem(db, o, { nftId: 'emerald-ape-042', editionId: '1/10', quantity: 2 }, 'add')
  const c = upsertCartItem(db, o, { nftId: 'emerald-ape-042', editionId: '1/10', quantity: 2 }, 'add')
  assert.equal(c.items[0].quantity, 4)
  assert.equal(code(() => upsertCartItem(db, o, { nftId: 'emerald-ape-042', editionId: '1/10', quantity: 1 }, 'add')), 'availability_conflict')
  assert.equal(removeCartItem(db, o, c.items[0].id).items.length, 0)
})

test('carrinhos não vazam entre donos e o visitante é mesclado ao entrar', () => {
  const db = createDb()
  upsertCartItem(db, anonOwner('a1'), { nftId: 'emerald-ape-042', editionId: 'aberta', quantity: 2 }, 'set')
  upsertCartItem(db, userOwner('u_1'), { nftId: 'emerald-ape-042', editionId: 'aberta', quantity: 1 }, 'set')
  assert.equal(getCart(db, userOwner('u_2')).items.length, 0)
  mergeCarts(db, anonOwner('a1'), userOwner('u_1'))
  assert.equal(getCart(db, userOwner('u_1')).items[0].quantity, 3)
  assert.equal(getCart(db, anonOwner('a1')).items.length, 0)
  assert.equal(getCart(db, userOwner('u_2')).items.length, 0)
})

test('pedido: idempotente, confirma após o prazo, baixa estoque e limpa o carrinho', () => {
  const { db, owner } = figmaCart()
  const q = createQuote(db, owner, 'u_1', null, T0)
  const a = placeOrder(db, { userId: 'u_1', key: 'k1', req: req(q.quoteId), now: T0 })
  const b = placeOrder(db, { userId: 'u_1', key: 'k1', req: req(q.quoteId), now: T0 + 50 })
  assert.equal(a.created, true)
  assert.equal(b.created, false)
  assert.equal(a.order.id, b.order.id)
  assert.equal(Object.keys(db.orders).length, 1)
  assert.equal(code(() => placeOrder(db, { userId: 'u_1', key: 'k1', req: req('qt_outro'), now: T0 })), 'idempotency_conflict')

  assert.equal(readOrder(db, 'u_1', a.order.id, T0 + 100, false).order.status, 'pending')
  const before = db.nfts.find((n) => n.id === 'emerald-ape-042')!.editions.find((e) => e.id === '1/50')!.available
  const done = readOrder(db, 'u_1', a.order.id, T0 + ORDER_SETTLE_MS, false)
  assert.equal(done.order.status, 'confirmed')
  assert.equal(done.order.receipt?.totalEth, '26.846')
  assert.equal(done.order.receipt?.walletLabel, 'MetaMask')
  assert.equal(done.events.order.length, 1)
  assert.equal(done.events.nft.length, 3)
  assert.equal(db.nfts.find((n) => n.id === 'emerald-ape-042')!.editions.find((e) => e.id === '1/50')!.available, (before as number) - 2)
  assert.equal(getCart(db, owner).items.length, 0)
  // reler não gera novos eventos nem muda a versão
  const again = readOrder(db, 'u_1', a.order.id, T0 + 9999, false)
  assert.equal(again.events.order.length, 0)
  assert.equal(again.order.version, done.order.version)
})

test('pedido recusado e acesso de outro usuário', () => {
  const { db, owner } = figmaCart()
  const q = createQuote(db, owner, 'u_1', null, T0)
  const { order } = placeOrder(db, { userId: 'u_1', key: 'k2', req: req(q.quoteId), now: T0 })
  const r = readOrder(db, 'u_1', order.id, T0 + ORDER_SETTLE_MS, true)
  assert.equal(r.order.status, 'declined')
  assert.equal(r.order.receipt, null)
  assert.equal(code(() => readOrder(db, 'u_2', order.id, T0 + ORDER_SETTLE_MS, false)), 'not_found')
})

test('pedido: preço mudou, estoque esgotou, cotação expirada e validações', () => {
  const { db, owner } = figmaCart()
  const q = createQuote(db, owner, 'u_1', null, T0)
  changePrice(db, 'emerald-ape-042', '1.30', T0)
  try { placeOrder(db, { userId: 'u_1', key: 'k3', req: req(q.quoteId), now: T0 }); assert.fail('deveria falhar') } catch (e) {
    assert.ok(e instanceof DomainError)
    assert.equal(e.code, 'price_changed')
    const newQuote = (e.details as { quote: { quoteId: string; totalEth: string } }).quote
    assert.equal(newQuote.totalEth, '27.066') // 26.846 + 2 x (1.30 - 1.19)
    // com a nova cotação, o mesmo cliente conclui o pedido
    assert.equal(placeOrder(db, { userId: 'u_1', key: 'k3', req: req(newQuote.quoteId), now: T0 }).created, true)
  }

  const s = figmaCart()
  const q2 = createQuote(s.db, s.owner, 'u_1', null, T0)
  s.db.nfts.find((n) => n.id === 'emerald-ape-042')!.editions.find((e) => e.id === '1/50')!.available = 1
  assert.equal(code(() => placeOrder(s.db, { userId: 'u_1', key: 'k4', req: req(q2.quoteId), now: T0 })), 'availability_conflict')

  const x = figmaCart()
  const q3 = createQuote(x.db, x.owner, 'u_1', null, T0)
  assert.equal(code(() => placeOrder(x.db, { userId: 'u_1', key: 'k5', req: req(q3.quoteId), now: T0 + 11 * 60_000 })), 'conflict')
  assert.equal(code(() => placeOrder(x.db, { userId: 'u_1', key: '', req: req(q3.quoteId), now: T0 })), 'validation_error')
  assert.equal(code(() => placeOrder(x.db, { userId: 'u_2', key: 'k6', req: req(q3.quoteId), now: T0 })), 'conflict')
})

test('pedido: bump de preço do cenário gera evento e conflito', () => {
  const { db, owner } = figmaCart()
  const q = createQuote(db, owner, 'u_1', null, T0)
  assert.equal(code(() => placeOrder(db, { userId: 'u_1', key: 'k7', req: req(q.quoteId), now: T0, bumpPrice: true })), 'price_changed')
})

test('auth: cadastro, login, sessão e expiração', () => {
  const db = createDb()
  assert.equal(code(() => registerUser(db, { username: 'a', email: 'x', password: '123', confirmPassword: '1' }, T0)), 'validation_error')
  const ok = registerUser(db, { username: 'nova_pessoa', email: 'Nova@Kurio.test', password: 'Senha123', confirmPassword: 'Senha123' }, T0)
  assert.equal(ok.session.user.email, 'nova@kurio.test')
  assert.equal(code(() => registerUser(db, { username: 'outra', email: 'nova@kurio.test', password: 'Senha123', confirmPassword: 'Senha123' }, T0)), 'conflict')
  assert.equal(code(() => loginUser(db, { email: 'nova@kurio.test', password: 'errada123' }, T0)), 'invalid_credentials')
  const l = loginUser(db, { email: 'colecionador@kurio.test', password: 'Kurio@123' }, T0, 1000)
  assert.equal(resolveSession(db, l.token, T0 + 10).user.id, 'u_1')
  assert.equal(code(() => resolveSession(db, l.token, T0 + 1000)), 'session_expired')
  assert.equal(code(() => resolveSession(db, l.token, T0 + 1001)), 'session_invalid')
  assert.equal(code(() => resolveSession(db, null, T0)), 'session_invalid')
})
