import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { RootLayout } from '@/components/layout/RootLayout'
import {
  CartPage, CheckoutPage, ComingSoonPage, HomePage, LoginPage, NftDetailPage, NotFoundPage,
  OrderPage, ProfilePage, RegisterPage, WalletsPage,
} from '@/routes/pages'

export interface RouterContext { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

const route = (path: string, component: () => React.JSX.Element) =>
  createRoute({ getParentRoute: () => rootRoute, path, component })

// Rotas privadas (checkout, perfil, carteiras, pedido) ganham `beforeLoad` com guarda de sessão na etapa 5.
const routeTree = rootRoute.addChildren([
  route('/', HomePage),
  route('/nft/$nftId', NftDetailPage),
  route('/carrinho', CartPage),
  route('/pagamento', CheckoutPage),
  route('/pedido/$orderId', OrderPage),
  route('/entrar', LoginPage),
  route('/cadastro', RegisterPage),
  route('/perfil', ProfilePage),
  route('/perfil/carteiras', WalletsPage),
  route('/em-breve', ComingSoonPage),
])

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined! as QueryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
