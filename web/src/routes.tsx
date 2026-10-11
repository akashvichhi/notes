import { createBrowserRouter } from 'react-router'

import { RequireAuth } from '@/components/RequireAuth'
import { AppPage } from '@/pages/AppPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/', element: <RequireAuth><AppPage /></RequireAuth> },
  { path: '/notes/:uuid', element: <RequireAuth><AppPage /></RequireAuth> },
])
