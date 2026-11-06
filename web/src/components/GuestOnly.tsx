import { memo, type ReactNode } from 'react'
import { Navigate } from 'react-router'

import { Center, Loader } from '@mantine/core'

import { useMe } from '@/hooks/queries/useAuth'

/** The counterpart of RequireAuth: sign-in and sign-up pages send a signed-in user to their notes. */
export const GuestOnly = memo(function GuestOnly({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe()

  // Wait for the session check, so the form never flashes before the redirect.
  if (isLoading) {
    return (
      <Center h="100dvh">
        <Loader size="md" />
      </Center>
    )
  }
  if (user) return <Navigate replace to="/" />

  return <>{children}</>
})
