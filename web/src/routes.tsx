import { createBrowserRouter } from 'react-router'

import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
import { RequireAuth } from '@/components/RequireAuth'
import { AppPage } from '@/pages/AppPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/register', element: <RegisterPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/', element: <RequireAuth><AppPage /></RequireAuth>, errorElement: <RouteErrorBoundary /> },
  { path: '/notes/:uuid', element: <RequireAuth><AppPage /></RequireAuth>, errorElement: <RouteErrorBoundary /> },
])
