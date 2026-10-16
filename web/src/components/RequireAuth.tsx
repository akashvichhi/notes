import { memo, type ReactNode } from 'react'
import { Navigate } from 'react-router'

import { AppSkeleton } from '@/components/common/Skeletons'
import { useMe } from '@/hooks/queries/useAuth'
import { isNative } from '@/platform/isNative'

export const RequireAuth = memo(function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe()

  // Native apps (desktop & mobile) are local-first and work without login
  if (isNative()) {
    return <>{children}</>
  }

  // A skeleton of the real layout, not a centred spinner.
  if (isLoading) return <AppSkeleton />
  if (!user) return <Navigate replace to="/login" />

  return <>{children}</>
})

