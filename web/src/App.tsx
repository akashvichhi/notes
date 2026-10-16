import { useEffect } from 'react'
import { RouterProvider } from 'react-router'

import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'
import { syncEngine } from '@/sync/engine'

export function App() {
  useEffect(() => {
    syncEngine.start()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
