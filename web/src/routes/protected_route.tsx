import { memo, type ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useMe } from '@src/queries/auth_queries'
import { AppSkeleton } from '@src/ui/skeletons/skeletons'

import { ROUTE_PATHS } from './route_paths'

export const RequireAuth: React.MemoExoticComponent<({ children }: { children: ReactNode; }) => React.JSX.Element> = memo(function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe()

  // A skeleton of the real layout, not a centred spinner.
  if (isLoading) return <AppSkeleton />
  if (!user) return <Navigate replace to={ROUTE_PATHS.LOGIN} />

  return <>{children}</>
})

