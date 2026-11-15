import { type ComponentType, lazy, type LazyExoticComponent, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'

import { PageSkeleton } from '@src/ui/skeletons/page_skeleton'
import { AppSkeleton } from '@src/ui/skeletons/skeletons'

import { GuestOnly } from './guest_route'
import { RequireAuth } from './protected_route'
import { RouteBoundary } from './route_boundary'
import { RouteErrorBoundary } from './route_error'
import { NOTES_PAGE_PATHS, ROUTE_PATHS } from './route_paths'

type TLazyPage = LazyExoticComponent<ComponentType>

const LoginPage: TLazyPage = lazy(() => import('@src/pages/login/login_page').then((m: { LoginPage: ComponentType }): { default: ComponentType } => ({ default: m.LoginPage })))
const RegisterPage: TLazyPage = lazy(() => import('@src/pages/register/register_page').then((m: { RegisterPage: ComponentType }): { default: ComponentType } => ({ default: m.RegisterPage })))
const AccessTokensPage: TLazyPage = lazy(() =>
  import('@src/pages/access_tokens/access_tokens_page').then((m: { AccessTokensPage: ComponentType }): { default: ComponentType } => ({ default: m.AccessTokensPage }))
)
const AppPage: TLazyPage = lazy(() => import('@src/pages/notes/notes_page').then((m: { AppPage: ComponentType }): { default: ComponentType } => ({ default: m.AppPage })))

const PAGE_FALLBACK: ReactNode = <PageSkeleton />
const APP_FALLBACK: ReactNode = <AppSkeleton />
const ROUTE_ERROR: ReactNode = <RouteErrorBoundary />

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path:         ROUTE_PATHS.LOGIN,
    element:      <GuestOnly><RouteBoundary fallback={PAGE_FALLBACK}><LoginPage /></RouteBoundary></GuestOnly>,
    errorElement: ROUTE_ERROR,
  },
  {
    path:         ROUTE_PATHS.REGISTER,
    element:      <GuestOnly><RouteBoundary fallback={PAGE_FALLBACK}><RegisterPage /></RouteBoundary></GuestOnly>,
    errorElement: ROUTE_ERROR,
  },
  ...NOTES_PAGE_PATHS.map((path: string): RouteObject => ({
    path,
    element:      <RequireAuth><RouteBoundary fallback={APP_FALLBACK}><AppPage /></RouteBoundary></RequireAuth>,
    errorElement: ROUTE_ERROR,
  })),
  {
    path:         ROUTE_PATHS.ACCESS_TOKENS,
    element:      <RequireAuth><RouteBoundary fallback={PAGE_FALLBACK}><AccessTokensPage /></RouteBoundary></RequireAuth>,
    errorElement: ROUTE_ERROR,
  },
])
