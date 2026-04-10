import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import axios from 'axios'
import { config } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ClientsListPage } from '@/features/clients/ClientsListPage'
import { ClientFormPage } from '@/features/clients/ClientFormPage'
import { ProductsListPage } from '@/features/products/ProductsListPage'
import { ProductFormPage } from '@/features/products/ProductFormPage'
import { KitsListPage } from '@/features/kits/KitsListPage'
import { KitFormPage } from '@/features/kits/KitFormPage'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  component: AppLayout,
  beforeLoad: async () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${config.apiBaseUrl}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        useAuthStore.getState().setAuth(data.accessToken, decodeToken(data.accessToken))
      } catch {
        throw redirect({ to: '/login' })
      }
    }
  },
})

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: () => (
    <div>
      <h1 style={{ fontSize: '1.5rem', color: 'var(--color-neutral-900)' }}>
        Bem-vindo ao Constru Manager
      </h1>
      <p style={{ color: 'var(--color-neutral-600)' }}>Selecione um item no menu lateral.</p>
    </div>
  ),
})

const clientsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/clients',
  component: ClientsListPage,
})

const clientCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/clients/new',
  component: ClientFormPage,
})

const clientEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/clients/$id/edit',
  component: ClientFormPage,
})

const productsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/products',
  component: ProductsListPage,
})

const productCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/products/new',
  component: ProductFormPage,
})

const productEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/products/$id/edit',
  component: ProductFormPage,
})

const kitsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/kits',
  component: KitsListPage,
})

const kitCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/kits/new',
  component: KitFormPage,
})

const kitEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/kits/$id/edit',
  component: KitFormPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    clientsRoute,
    clientCreateRoute,
    clientEditRoute,
    productsRoute,
    productCreateRoute,
    productEditRoute,
    kitsRoute,
    kitCreateRoute,
    kitEditRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
