import { memo, type ReactNode } from 'react'
import { Navigate } from 'react-router'

import { isNative } from '@src/platform/is_native'
import { useMe } from '@src/queries/auth_queries'
import { AppSkeleton } from '@src/ui/skeletons/skeletons'

import { ROUTE_PATHS } from './route_paths'

export const RequireAuth = memo(function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe()

  // Native apps (desktop & mobile) are local-first and work without login
  if (isNative()) {
    return <>{children}</>
  }

  // A skeleton of the real layout, not a centred spinner.
  if (isLoading) return <AppSkeleton />
  if (!user) return <Navigate replace to={ROUTE_PATHS.LOGIN} />

  return <>{children}</>
})

