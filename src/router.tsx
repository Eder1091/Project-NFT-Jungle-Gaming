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

// Cada rota é declarada com o caminho literal para que o <Link to="..."> seja tipado de ponta a ponta.
// Rotas privadas (pagamento, pedido, perfil, carteiras) ganham `beforeLoad` com guarda de sessão na etapa 5.
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })
const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$nftId', component: NftDetailPage })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/carrinho', component: CartPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pagamento', component: CheckoutPage })
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pedido/$orderId', component: OrderPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/entrar', component: LoginPage })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cadastro', component: RegisterPage })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', component: ProfilePage })
const walletsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil/carteiras', component: WalletsPage })
const comingSoonRoute = createRoute({ getParentRoute: () => rootRoute, path: '/em-breve', component: ComingSoonPage })

const routeTree = rootRoute.addChildren([
  indexRoute, nftRoute, cartRoute, checkoutRoute, orderRoute,
  loginRoute, registerRoute, profileRoute, walletsRoute, comingSoonRoute,
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