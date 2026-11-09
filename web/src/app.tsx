import { useEffect } from 'react'
import { RouterProvider } from 'react-router'

import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@src/queries/query_client'
import { router } from '@src/routes/app_routes'
import { syncEngine } from '@src/sync/engine'

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
