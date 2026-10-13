import { RouterProvider } from 'react-router'

import { QueryClientProvider } from '@tanstack/react-query'


import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
