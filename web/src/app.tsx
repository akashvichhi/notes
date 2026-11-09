import { useEffect } from 'react'
import { RouterProvider } from 'react-router'

import { QueryClientProvider } from '@tanstack/react-query'

import { loadToken } from '@src/platform/secure_store'
import { queryClient } from '@src/queries/query_client'
import { router } from '@src/routes/app_routes'
import { chooseStartingContainer } from '@src/stores/ui_store'
import { syncEngine } from '@src/sync/engine'

export function App() {
  useEffect(() => {
    syncEngine.start()
    void loadToken().then((token: string | null): void => chooseStartingContainer(token !== null))
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
