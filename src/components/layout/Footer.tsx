import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const COLUMNS = [
  { title: 'Meu perfil', links: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'] },
  { title: 'Central de ajuda', links: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'] },
  { title: 'Coleções', links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'] },
]

export function Footer() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus({ kind: 'error', text: 'Digite um e-mail válido.' })
      return
    }
    // Fora do escopo do desafio: não simulamos sucesso para não aparentar funcionalidade.
    setStatus({ kind: 'info', text: 'O envio de alertas não está disponível nesta demonstração.' })
  }

  return (
    <footer className="mx-auto mt-24 max-w-[1200px] px-4 md:px-6">
      <div className="grid gap-8 bg-card p-6 md:grid-cols-[1fr_1fr_1fr_1.2fr] md:p-10">
        {FEATURES.map((f) => (
          <div key={f.letter} className="md:border-r md:border-primary/60 md:pr-6">
            <div aria-hidden="true" className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {f.letter}
            </div>
            <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{f.text}</p>
          </div>
        ))}
        <form onSubmit={onSubmit} noValidate aria-labelledby="news-title">
          <h3 id="news-title" className="mb-3 text-lg font-bold leading-tight">Antecipe-se ao próximo lançamento</h3>
          <div className="flex">
            <Input
              type="email"
              aria-label="Seu e-mail"
              aria-invalid={status?.kind === 'error'}
              aria-describedby="news-status"
              placeholder="digite seu e-mail..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-r-none border-0 bg-background/40"
            />
            <Button type="submit" className="h-11 rounded-l-none">Enviar</Button>
          </div>
          <p id="news-status" role="status" className={status?.kind === 'error' ? 'mt-3 text-sm text-destructive' : 'mt-3 text-sm text-muted-foreground'}>
            {status?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
          </p>
        </form>
      </div>

      <div className="grid gap-4 bg-band px-6 py-6 text-sm md:grid-cols-4 md:px-10">
        <span className="font-bold tracking-[0.25em]">KURIO</span>
        <p>Feito para colecionadores,<br />criadores e cultura</p>
        <a href="mailto:contato@email.com" className="hover:text-highlight">contato@email.com</a>
        <a href="tel:+551140028922" className="hover:text-highlight">+55 11 4002 8922</a>
      </div>

      <div className="grid gap-8 bg-card px-6 py-10 md:grid-cols-4 md:px-10">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-3 text-lg font-bold">{col.title}</h3>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l}><Link to="/em-breve" className="hover:text-highlight">{l}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h3 className="mb-3 text-lg font-bold">Redes sociais</h3>
          <ul className="flex gap-2">
            {[
              [Facebook, 'Facebook'], [Instagram, 'Instagram'], [Twitter, 'Twitter'], [Linkedin, 'LinkedIn'], [Youtube, 'YouTube'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Facebook
              return (
                <li key={label as string}>
                  <a href="https://example.com" target="_blank" rel="noreferrer noopener" aria-label={label as string} className="flex h-9 w-9 items-center justify-center rounded-md border border-primary text-highlight hover:bg-primary/10">
                    <I className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
              )
            })}
          </ul>
          <h3 className="mb-3 mt-8 text-lg font-bold">Carteiras compatíveis</h3>
          <p className="inline-block rounded-md border border-border bg-background/40 px-3 py-1.5 text-[10px] font-bold tracking-wider text-highlight">
            METAMASK • WALLETCONNECT • COINBASE
          </p>
        </div>
      </div>

      <p className="py-6 text-center text-sm text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
