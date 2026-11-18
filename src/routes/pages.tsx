import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

/** Páginas provisórias das próximas etapas. Cada uma será substituída pela implementação real. */
function Placeholder({ title, step }: { title: string; step: string }) {
  return (
    <section aria-labelledby="titulo" className="py-16 text-center">
      <h1 id="titulo" className="mb-3 text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Esta tela será implementada na {step}.</p>
    </section>
  )
}

export const HomePage = () => <Placeholder title="Início" step="etapa 3 (catálogo)" />
export const NftDetailPage = () => <Placeholder title="Detalhes do NFT" step="etapa 3 (detalhe)" />
export const CartPage = () => <Placeholder title="Carrinho de NFTs" step="etapa 4" />
export const CheckoutPage = () => <Placeholder title="Pagamento" step="etapa 4" />
export const OrderPage = () => <Placeholder title="Confirmação de pedido" step="etapa 4" />
export const LoginPage = () => <Placeholder title="Entrar" step="etapa 5" />
export const RegisterPage = () => <Placeholder title="Criar perfil de colecionador" step="etapa 5" />
export const ProfilePage = () => <Placeholder title="Perfil do colecionador" step="etapa 5" />
export const WalletsPage = () => <Placeholder title="Carteiras" step="etapa 5" />

export function ComingSoonPage() {
  return (
    <section aria-labelledby="titulo" className="py-16 text-center">
      <h1 id="titulo" className="mb-3 text-2xl font-bold">Esta página não faz parte desta versão</h1>
      <p className="mb-6 text-muted-foreground">Estamos construindo o fluxo de compra e a conta do colecionador primeiro.</p>
      <Button asChild><Link to="/">Voltar ao início</Link></Button>
    </section>
  )
}

export function NotFoundPage() {
  return (
    <section aria-labelledby="titulo" className="py-16 text-center">
      <h1 id="titulo" className="mb-3 text-2xl font-bold">Página não encontrada</h1>
      <p className="mb-6 text-muted-foreground">O endereço que você acessou não existe.</p>
      <Button asChild><Link to="/">Voltar ao início</Link></Button>
    </section>
  )
}
