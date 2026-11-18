import { Outlet } from '@tanstack/react-router'
import { Header } from './Header'
import { Footer } from './Footer'

export function RootLayout() {
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="mx-auto min-h-[60vh] max-w-[1200px] px-4 py-8 md:px-6">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
