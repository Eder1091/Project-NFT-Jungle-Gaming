import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: { DEFAULT: c('card'), foreground: c('foreground') },
        band: c('band'),
        primary: { DEFAULT: c('primary'), foreground: c('background') },
        highlight: c('highlight'),
        muted: { DEFAULT: c('card'), foreground: c('muted-foreground') },
        border: c('border'),
        rule: c('rule'),
        input: c('border'),
        ring: c('highlight'),
        destructive: { DEFAULT: c('destructive'), foreground: c('foreground') },
      },
      fontFamily: { sans: ['"Roboto Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'] },
      borderRadius: { lg: '0.75rem', md: '0.5rem', sm: '0.25rem', card: '1.75rem' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [animate],
} satisfies Config
