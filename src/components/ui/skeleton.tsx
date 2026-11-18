import { cn } from '@/lib/utils'

/** Skeleton com shimmer. O brilho é desligado com prefers-reduced-motion (ver index.css). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton"
      className={cn('relative overflow-hidden rounded-md bg-card', className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
    </div>
  )
}
