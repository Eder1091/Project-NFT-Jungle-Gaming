import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { createQueryClient } from './lib/queryClient'
import './styles/index.css'

const queryClient = createQueryClient()

const MOCKS = import.meta.env.VITE_ENABLE_MOCKS === 'true'

async function enableMocking() {
  if (!MOCKS) return
  const { worker, installMockControls } = await import('./mocks/browser')
  installMockControls(import.meta.env.VITE_MOCK_SCENARIO)
  await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } })
  const { startRealtime } = await import('./realtime/socket')
  const { REALTIME_PATH, REALTIME_URL } = await import('./mocks/socket')
  const { getToken } = await import('./lib/session')
  startRealtime({ url: REALTIME_URL, path: REALTIME_PATH, getToken })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ queryClient }} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
