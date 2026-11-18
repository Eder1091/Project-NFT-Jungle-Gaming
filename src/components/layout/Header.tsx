import { Link, useRouterState } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Itens do menu e quais prefixos de rota os mantêm ativos (Mercado cobre detalhe, carrinho e pagamento). */
const NAV = [
  { label: 'Início', to: '/', match: (p: string) => p === '/' || p.startsWith('/perfil') },
  { label: 'Mercado', to: '/', hash: 'catalogo', match: (p: string) => p.startsWith('/nft') || p.startsWith('/carrinho') || p.startsWith('/pagamento') },
  { label: 'Criadores', to: '/em-breve', match: (p: string) => p === '/em-breve' },
  { label: 'Aprenda', to: '/em-breve', match: () => false },
] as const

export function Header({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:h-[70px] md:px-6">
        <Link to="/" className="text-sm font-bold tracking-[0.25em]" aria-label="Kurio, página inicial">
          KURIO
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-10">
            {NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    hash={'hash' in item ? item.hash : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-block py-5 text-base transition-colors hover:text-highlight',
                      active ? 'font-semibold text-highlight after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-primary' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3 md:gap-5">
          <Link to="/" aria-label="Buscar NFTs" className="rounded-md p-2 hover:text-highlight">
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link to="/carrinho" aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`} className="relative rounded-md p-2 hover:text-highlight">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>
          <Button asChild variant="default" size="default" className="gap-1.5">
            <Link to="/entrar">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Entrar
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
