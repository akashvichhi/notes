import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { AppSkeleton } from '@/components/common/Skeletons'
import { useMe } from '@/hooks/queries/useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe()

  // A skeleton of the real layout, not a centred spinner.
  if (isLoading) return <AppSkeleton />
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
