# Kurio — NFT Marketplace (desafio frontend)

> Estado atual: **etapa 1 (scaffold)**. Rotas, layout base, tokens do Figma, contratos tipados e aritmética ETH exata estão prontos.
> Catálogo, carrinho, checkout, conta, mocks (MSW + Socket.IO) e testes entram nas próximas etapas.

## Rodar
```bash
npm install        # o postinstall gera public/mockServiceWorker.js
cp .env.example .env
npm run dev
```
Comandos: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run preview`, `npm run test:e2e`, `npm run lighthouse`.

## Notas de fidelidade (Figma)
- Cores medidas por amostragem de pixels nos prints; conferir com o Dev Mode.
- No carrinho mobile do Figma, o subtotal (8.92) não bate com a soma das linhas (8.14). O app calcula pelos itens.
