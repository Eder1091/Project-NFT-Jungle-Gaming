# Kurio — NFT Marketplace (desafio frontend)

> Estado atual: **etapa 2 (camada de mocks)**. Rotas, layout, tokens do Figma, contratos tipados, API simulada (MSW) e Socket.IO simulado prontos.
> Catálogo, detalhe, carrinho, checkout, conta e testes E2E entram nas próximas etapas.

## Rodar
```bash
npm install        # o postinstall gera public/mockServiceWorker.js
cp .env.example .env
npm run dev
```
Comandos: `typecheck`, `lint`, `build`, `preview`, `test:unit` (Node, sem dependências extras), `test:e2e`, `lighthouse`.

## API simulada (MSW)
Tudo roda no navegador. O estado persiste no `localStorage` (chave `kurio-mock-db-v1`) e sobrevive a recarregamentos.

| Dado | Valor |
|---|---|
| Usuário demo | `colecionador@kurio.test` / `Kurio@123` |
| Segundo usuário (teste de isolamento) | `outro@kurio.test` / `Kurio@123` |
| Cupons | `KURIO10` (10%), `GENESIS20` (20%), `OLD2025` (expirado), qualquer outro = inválido |
| Taxa de rede | 0.016 ETH |

Endpoints: `/api/nfts`, `/api/nfts/:id`, `/api/nfts/:id/related`, `/api/favorites`, `/api/cart`, `/api/cart/items`, `/api/cart/quote`, `/api/orders`, `/api/auth/*`.

### Cenários
Escolha por `?mock-scenario=<nome>` na URL, por `VITE_MOCK_SCENARIO`, ou em runtime com `window.__mock.setScenario('slow')`.

| Cenário | Efeito |
|---|---|
| `default` | tudo funciona |
| `empty` | catálogo vazio |
| `slow` | cada requisição demora ~2 s |
| `flaky` | a 1ª tentativa de cada GET falha com 503 (o retry recupera) |
| `catalog-error` | catálogo sempre falha |
| `session-expired` | a sessão dura 3 s após o login |
| `price-change` | o preço muda no 1º envio do pedido (409 `price_changed`) |
| `payment-declined` | o pedido termina como recusado |
| `order-timeout` | a 1ª tentativa de `POST /orders` nunca responde; o pedido é criado e o retry com a mesma `Idempotency-Key` o reaproveita |

### Controles no console do navegador
`window.__mock`: `setScenario`, `reset()`, `changePrice(nftId, '1.50')`, `expireSessions()`, `connectedPeers()`.

### Tempo real (Socket.IO)
O app usa o `socket.io-client` real. O MSW intercepta a conexão em `wss://realtime.kurio.test/socket.io/` e o `@mswjs/socket.io-binding` decodifica o protocolo.
Eventos: `nft.updated` (todos) e `order.updated` (só o dono do pedido). O cliente descarta eventos duplicados (por `eventId`) e antigos (por `version`).

### Regras do servidor simulado
- Valores em ETH são strings decimais e cálculos usam BigInt (sem float).
- Pedido idempotente: mesma `Idempotency-Key` + mesma cotação devolve o mesmo pedido; outra cotação com a mesma chave dá 422.
- Pedido nasce `pending` e vira `confirmed`/`declined` após ~2,5 s. O estado também é resolvido na leitura (`GET /orders/:id`), então recarregar a página não perde o pedido.
- Confirmar um pedido baixa o estoque das edições limitadas e limpa os itens comprados do carrinho.
- Carrinhos são por dono (`user:<id>` ou `anon:<id>`) e o carrinho de visitante é mesclado ao do usuário no login.

## Notas de fidelidade (Figma)
- Cores medidas por amostragem de pixels nos prints; conferir com o Dev Mode.
- No carrinho mobile do Figma, o subtotal (8.92) não bate com a soma das linhas (8.14). O app calcula pelos itens.
