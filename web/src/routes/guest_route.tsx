import { memo, type ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useMe } from '@src/queries/auth_queries'
import { FullScreenLoader } from '@src/ui/feedback/full_screen_loader'

import { ROUTE_PATHS } from './route_paths'

/** The counterpart of RequireAuth: sign-in and sign-up pages send a signed-in user to their notes. */
export const GuestOnly: React.NamedExoticComponent<{ children: ReactNode }> = memo(function GuestOnly({ children }: { children: ReactNode }): React.JSX.Element {
  const { data: user, isLoading } = useMe()

  // Wait for the session check, so the form never flashes before the redirect.
  if (isLoading) return <FullScreenLoader />
  if (user) return <Navigate replace to={ROUTE_PATHS.HOME} />

  return <>{children}</>
})
