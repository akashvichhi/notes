import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { Center, Loader } from '@mantine/core'

import { RouteErrorBoundary } from './route_error'
import { AppSkeleton } from '@src/ui/skeletons/skeletons'
import { GuestOnly } from './guest_route'
import { RequireAuth } from './protected_route'
import { ROUTE_PATHS } from './route_paths'

const LoginPage = lazy(() => import('@src/pages/login/login_page').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@src/pages/register/register_page').then((m) => ({ default: m.RegisterPage })))
const AccessTokensPage = lazy(() =>
  import('@src/pages/access_tokens/access_tokens_page').then((m) => ({ default: m.AccessTokensPage }))
)
const AppPage = lazy(() => import('@src/pages/notes/notes_page').then((m) => ({ default: m.AppPage })))

const AuthFallback = (
  <Center h="100dvh">
    <Loader size="md" />
  </Center>
)

const AppFallback = <AppSkeleton />

export const router = createBrowserRouter([
  {
    path:    ROUTE_PATHS.LOGIN,
    element: (
      <GuestOnly>
        <Suspense fallback={AuthFallback}>
          <LoginPage />
        </Suspense>
      </GuestOnly>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path:    ROUTE_PATHS.REGISTER,
    element: (
      <GuestOnly>
        <Suspense fallback={AuthFallback}>
          <RegisterPage />
        </Suspense>
      </GuestOnly>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path:    ROUTE_PATHS.HOME,
    element: (
      <RequireAuth>
        <Suspense fallback={AppFallback}>
          <AppPage />
        </Suspense>
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path:    ROUTE_PATHS.NOTE,
    element: (
      <RequireAuth>
        <Suspense fallback={AppFallback}>
          <AppPage />
        </Suspense>
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path:    ROUTE_PATHS.ACCESS_TOKENS,
    element: (
      <RequireAuth>
        <Suspense fallback={AuthFallback}>
          <AccessTokensPage />
        </Suspense>
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
])
