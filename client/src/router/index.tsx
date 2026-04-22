import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import axios from 'axios'
import { config } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken, isTokenExpired } from '@/lib/jwt'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ClientsListPage } from '@/features/clients/ClientsListPage'
import { ClientFormPage } from '@/features/clients/ClientFormPage'
import { ProductsListPage } from '@/features/products/ProductsListPage'
import { ProductFormPage } from '@/features/products/ProductFormPage'
import { KitsListPage } from '@/features/kits/KitsListPage'
import { KitFormPage } from '@/features/kits/KitFormPage'
import { QuotesListPage } from '@/features/quotes/QuotesListPage'
import { QuoteFormPage } from '@/features/quotes/QuoteFormPage'
import { QuoteDetailPage } from '@/features/quotes/QuoteDetailPage'
import { QuoteVersionFormPage } from '@/features/quotes/QuoteVersionFormPage'
import { FixedExpensesListPage } from '@/features/fixed-expenses/FixedExpensesListPage'
import { FixedExpenseFormPage } from '@/features/fixed-expenses/FixedExpenseFormPage'
import { FinanceDashboardPage } from '@/features/finance/FinanceDashboardPage'
import { DrePage } from '@/features/finance/DrePage'
import { UsersListPage } from '@/features/users/UsersListPage'
import { UserFormPage } from '@/features/users/UserFormPage'

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
    if (accessToken && !isTokenExpired(accessToken)) return
    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${config.apiBaseUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      useAuthStore.getState().setAuth(data.accessToken, decodeToken(data.accessToken))
    } catch {
      useAuthStore.getState().clearAuth()
      throw redirect({ to: '/login' })
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

const quotesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes',
  component: QuotesListPage,
})

const quoteCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes/new',
  component: QuoteFormPage,
})

const quoteDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes/$id',
  component: QuoteDetailPage,
})

const quoteAddVersionRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes/$id/versions/new',
  component: QuoteVersionFormPage,
})

const fixedExpensesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/fixed-expenses',
  component: FixedExpensesListPage,
})

const fixedExpenseCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/fixed-expenses/new',
  component: FixedExpenseFormPage,
})

const fixedExpenseEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/fixed-expenses/$id/edit',
  component: FixedExpenseFormPage,
})

const financeDashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/finance',
  component: FinanceDashboardPage,
})

const dreRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dre',
  component: DrePage,
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user?.role !== 'ADMIN' && user?.role !== 'FINANCE') {
      throw redirect({ to: '/' })
    }
  },
})

const usersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users',
  component: UsersListPage,
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user?.role !== 'ADMIN') throw redirect({ to: '/' })
  },
})

const userCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/new',
  component: UserFormPage,
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user?.role !== 'ADMIN') throw redirect({ to: '/' })
  },
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
    quotesRoute,
    quoteCreateRoute,
    quoteDetailRoute,
    quoteAddVersionRoute,
    fixedExpensesRoute,
    fixedExpenseCreateRoute,
    fixedExpenseEditRoute,
    financeDashboardRoute,
    dreRoute,
    usersRoute,
    userCreateRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
