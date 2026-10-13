/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'

import { Center, Loader } from '@mantine/core'

import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
import { AppSkeleton } from '@/components/common/Skeletons'
import { RequireAuth } from '@/components/RequireAuth'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const AppPage = lazy(() => import('@/pages/AppPage').then((m) => ({ default: m.AppPage })))

const AuthFallback = (
  <Center h="100dvh">
    <Loader size="md" />
  </Center>
)

const AppFallback = <AppSkeleton />

export const router = createBrowserRouter([
  {
    path:    '/login',
    element: (
      <Suspense fallback={AuthFallback}>
        <LoginPage />
      </Suspense>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path:    '/register',
    element: (
      <Suspense fallback={AuthFallback}>
        <RegisterPage />
      </Suspense>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path:    '/',
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
    path:    '/notes/:uuid',
    element: (
      <RequireAuth>
        <Suspense fallback={AppFallback}>
          <AppPage />
        </Suspense>
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
  },
])
