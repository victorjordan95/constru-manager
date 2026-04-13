# Phase 3b — Frontend CRUD Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build authenticated React pages for clients, products, and kits CRUD, wired to the Phase 3a API using TanStack Router + TanStack Query + Zustand.

**Architecture:** Zustand stores `accessToken` in memory (never localStorage). Axios interceptors attach Bearer tokens and handle 401 → silent refresh → retry. TanStack Router guards authenticated routes via `beforeLoad`. TanStack Query manages server state per entity. Each feature lives under `client/src/features/<name>/` with its own `types.ts`, `api.ts`, `hooks.ts`, and page components.

**Tech Stack:** React 19, TypeScript 6, TanStack Router v1 (code-based), TanStack Query v5, Zustand v5, Axios 1.x, SCSS design tokens (already in `src/styles/tokens.scss`).

---

## File Map

**New files:**
- `client/.env.local` — Vite env: `VITE_API_BASE_URL=http://localhost:3000`
- `client/src/lib/jwt.ts` — decode JWT payload without a library
- `client/src/lib/axios.ts` — axios instance with Bearer interceptor + 401-refresh loop
- `client/src/lib/queryClient.ts` — TanStack Query client singleton
- `client/src/lib/format.ts` — `formatCurrency(cents)` → BRL string
- `client/src/stores/authStore.ts` — Zustand: `accessToken`, `user`, `setAuth`, `clearAuth`
- `client/src/features/auth/api.ts` — `login()`, `logout()`
- `client/src/features/auth/LoginPage.tsx` — email/password form
- `client/src/layouts/AppLayout.tsx` — sidebar nav + `<Outlet />`
- `client/src/router/index.tsx` — full route tree (built incrementally across tasks)
- `client/src/features/clients/types.ts`
- `client/src/features/clients/api.ts`
- `client/src/features/clients/hooks.ts`
- `client/src/features/clients/ClientsListPage.tsx`
- `client/src/features/clients/ClientFormPage.tsx`
- `client/src/features/products/types.ts`
- `client/src/features/products/api.ts`
- `client/src/features/products/hooks.ts`
- `client/src/features/products/ProductsListPage.tsx`
- `client/src/features/products/ProductFormPage.tsx`
- `client/src/features/kits/types.ts`
- `client/src/features/kits/api.ts`
- `client/src/features/kits/hooks.ts`
- `client/src/features/kits/KitsListPage.tsx`
- `client/src/features/kits/KitFormPage.tsx`

**Modified files:**
- `client/src/index.css` — replaced with minimal global reset
- `client/src/App.tsx` — replaced: RouterProvider + QueryClientProvider
- `client/src/features/auth/index.ts` — re-exports
- `client/src/features/clients/index.ts` — re-exports
- `client/src/features/products/index.ts` — re-exports
- `client/src/features/kits/index.ts` — re-exports

---

### Task 1: Foundation — Auth Store + Axios + QueryClient + JWT util

**Files:**
- Create: `client/.env.local`
- Create: `client/src/lib/jwt.ts`
- Create: `client/src/stores/authStore.ts`
- Create: `client/src/lib/axios.ts`
- Create: `client/src/lib/queryClient.ts`

- [ ] **Step 1: Create `.env.local`**

```
VITE_API_BASE_URL=http://localhost:3000
```

File: `client/.env.local`

- [ ] **Step 2: Create `client/src/lib/jwt.ts`**

```typescript
export interface AuthUser {
  userId: string
  role: 'ADMIN' | 'SALES' | 'FINANCE'
}

export function decodeToken(token: string): AuthUser {
  const payload = JSON.parse(atob(token.split('.')[1])) as {
    userId: string
    role: string
  }
  return {
    userId: payload.userId,
    role: payload.role as AuthUser['role'],
  }
}
```

- [ ] **Step 3: Create `client/src/stores/authStore.ts`**

```typescript
import { create } from 'zustand'
import type { AuthUser } from '@/lib/jwt'

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAuth: (accessToken: string, user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}))
```

- [ ] **Step 4: Create `client/src/lib/axios.ts`**

```typescript
import axios from 'axios'
import { config } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
})

// Attach Bearer token on every request
api.interceptors.request.use((reqConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) reqConfig.headers.Authorization = `Bearer ${token}`
  return reqConfig
})

// 401 → try silent refresh once → retry original request
let isRefreshing = false
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function processQueue(err: unknown, token: string | null) {
  queue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)))
  queue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error: unknown) => {
    const axiosError = error as { response?: { status: number }; config?: { _retry?: boolean; headers?: Record<string, string> } & object }
    const orig = axiosError.config
    if (!orig || axiosError.response?.status !== 401 || orig._retry) {
      return Promise.reject(error)
    }
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => queue.push({ resolve, reject })).then(
        (t) => {
          if (orig.headers) orig.headers.Authorization = `Bearer ${t}`
          return api(orig)
        },
      )
    }
    orig._retry = true
    isRefreshing = true
    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${config.apiBaseUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const { accessToken } = data
      useAuthStore.getState().setAuth(accessToken, decodeToken(accessToken))
      processQueue(null, accessToken)
      if (orig.headers) orig.headers.Authorization = `Bearer ${accessToken}`
      return api(orig)
    } catch (e) {
      processQueue(e, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(e)
    } finally {
      isRefreshing = false
    }
  },
)
```

- [ ] **Step 5: Create `client/src/lib/queryClient.ts`**

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})
```

- [ ] **Step 6: Verify TypeScript compiles**

Run from the project root:
```bash
cd /c/freela/constru-manager/client && npx tsc -p tsconfig.app.json --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
cd /c/freela/constru-manager && git add client/src/lib client/src/stores client/.env.local && git commit -m "feat(client): add auth store, axios interceptors, and query client"
```

---

### Task 2: Auth Feature + App Shell + Login Page + Router

**Files:**
- Create: `client/src/features/auth/api.ts`
- Create: `client/src/features/auth/LoginPage.tsx`
- Modify: `client/src/features/auth/index.ts`
- Create: `client/src/layouts/AppLayout.tsx`
- Create: `client/src/router/index.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Create `client/src/features/auth/api.ts`**

```typescript
import axios from 'axios'
import { config } from '@/config/env'
import { api } from '@/lib/axios'

// login uses plain axios — no Bearer token needed, response sets the httpOnly cookie
export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${config.apiBaseUrl}/auth/login`,
    { email, password },
    { withCredentials: true },
  )
  return data
}

// logout must send the Bearer token — use the authenticated api instance
export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
```

- [ ] **Step 2: Create `client/src/features/auth/LoginPage.tsx`**

```typescript
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'
import { login } from './api'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { accessToken } = await login(email, password)
      setAuth(accessToken, decodeToken(accessToken))
      void navigate({ to: '/' })
    } catch {
      setError('Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    marginTop: 4,
    boxSizing: 'border-box',
    fontSize: '1rem',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-neutral-100)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 8,
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            color: 'var(--color-primary)',
            margin: 0,
            fontFamily: 'var(--font-family)',
          }}
        >
          Constru Manager
        </h1>
        {error && (
          <p
            style={{
              color: 'var(--color-danger)',
              background: 'var(--color-danger-bg)',
              padding: 'var(--space-1)',
              borderRadius: 4,
              margin: 0,
              fontSize: '0.875rem',
            }}
          >
            {error}
          </p>
        )}
        <label>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Update `client/src/features/auth/index.ts`**

```typescript
export { LoginPage } from './LoginPage'
export { login, logout } from './api'
```

- [ ] **Step 4: Create `client/src/layouts/AppLayout.tsx`**

```typescript
import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { logout as apiLogout } from '@/features/auth/api'

export function AppLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await apiLogout()
    } catch {
      // ignore — still clear local auth
    }
    clearAuth()
    void navigate({ to: '/login' })
  }

  const linkStyle: React.CSSProperties = {
    color: 'inherit',
    textDecoration: 'none',
    display: 'block',
    padding: '6px 8px',
    borderRadius: 4,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-family)' }}>
      <nav
        style={{
          width: 'var(--sidebar-width)',
          flexShrink: 0,
          background: 'var(--color-primary)',
          color: 'var(--color-surface)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <p
          style={{
            fontWeight: 700,
            marginBottom: 'var(--space-3)',
            fontSize: '1rem',
          }}
        >
          Constru Manager
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
            <li>
              <Link to="/clients" style={linkStyle}>
                Clientes
              </Link>
            </li>
          )}
          {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
            <li>
              <Link to="/products" style={linkStyle}>
                Produtos
              </Link>
            </li>
          )}
          {user?.role === 'ADMIN' && (
            <li>
              <Link to="/kits" style={linkStyle}>
                Kits
              </Link>
            </li>
          )}
        </ul>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 'var(--space-2)' }}>
          <p style={{ fontSize: '0.75rem', marginBottom: 4, opacity: 0.7 }}>{user?.role}</p>
          <button
            onClick={() => void handleLogout()}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.5)',
              color: 'var(--color-surface)',
              padding: '6px var(--space-1)',
              borderRadius: 4,
              cursor: 'pointer',
              width: '100%',
              fontSize: '0.875rem',
            }}
          >
            Sair
          </button>
        </div>
      </nav>
      <main
        style={{
          flex: 1,
          padding: 'var(--space-4)',
          overflow: 'auto',
          background: 'var(--color-neutral-100)',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create `client/src/router/index.tsx`**

This version only includes auth + index routes. Clients/products/kits routes are added in later tasks.

```typescript
import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import axios from 'axios'
import { config } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// All authenticated routes descend from this route.
// beforeLoad tries a silent refresh if no accessToken in memory.
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([indexRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 6: Replace `client/src/App.tsx`**

```typescript
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { queryClient } from '@/lib/queryClient'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
```

- [ ] **Step 7: Replace `client/src/index.css`**

The old file has Vite's default styles (1126px max-width, etc.). Replace with a minimal global reset:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-family, system-ui, sans-serif);
  font-size: var(--font-size-base, 16px);
  color: var(--color-neutral-900);
  background: var(--color-neutral-100);
}

#root {
  min-height: 100vh;
}

h1, h2, h3 {
  margin: 0;
  font-weight: 600;
}

p {
  margin: 0;
}

button {
  font-family: inherit;
}

input, select, textarea {
  font-family: inherit;
  font-size: inherit;
}

a {
  color: inherit;
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /c/freela/constru-manager/client && npx tsc -p tsconfig.app.json --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
cd /c/freela/constru-manager && git add client/src/features/auth client/src/layouts client/src/router client/src/App.tsx client/src/index.css && git commit -m "feat(client): add login page, app shell, and router"
```

---

### Task 3: Clients Feature — Types, API, Hooks, List Page, Form Page

**Files:**
- Create: `client/src/features/clients/types.ts`
- Create: `client/src/features/clients/api.ts`
- Create: `client/src/features/clients/hooks.ts`
- Create: `client/src/features/clients/ClientsListPage.tsx`
- Create: `client/src/features/clients/ClientFormPage.tsx`
- Modify: `client/src/features/clients/index.ts`
- Modify: `client/src/router/index.tsx`

- [ ] **Step 1: Create `client/src/features/clients/types.ts`**

```typescript
export interface Client {
  id: string
  name: string
  taxId: string
  nationalId: string | null
  address: string | null
  zipCode: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateClientPayload {
  name: string
  taxId: string
  nationalId?: string
  address?: string
  zipCode?: string
  email?: string
  phone?: string
}

export type UpdateClientPayload = Partial<CreateClientPayload>
```

- [ ] **Step 2: Create `client/src/features/clients/api.ts`**

```typescript
import { api } from '@/lib/axios'
import type { Client, CreateClientPayload, UpdateClientPayload } from './types'

export async function listClients(): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients')
  return data
}

export async function getClient(id: string): Promise<Client> {
  const { data } = await api.get<Client>(`/clients/${id}`)
  return data
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const { data } = await api.post<Client>('/clients', payload)
  return data
}

export async function updateClient(id: string, payload: UpdateClientPayload): Promise<Client> {
  const { data } = await api.put<Client>(`/clients/${id}`, payload)
  return data
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`)
}
```

- [ ] **Step 3: Create `client/src/features/clients/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listClients, getClient, createClient, updateClient, deleteClient } from './api'
import type { CreateClientPayload, UpdateClientPayload } from './types'

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: listClients })
}

export function useClient(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => getClient(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClient(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateClientPayload }) =>
      updateClient(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
```

- [ ] **Step 4: Create `client/src/features/clients/ClientsListPage.tsx`**

```typescript
import { Link } from '@tanstack/react-router'
import { useClients, useDeleteClient } from './hooks'
import { useAuthStore } from '@/stores/authStore'

export function ClientsListPage() {
  const { data: clients, isLoading, error } = useClients()
  const deleteMutation = useDeleteClient()
  const { user } = useAuthStore()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar clientes.</p>

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Clientes</h1>
        <Link to="/clients/new">
          <button
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Novo Cliente
          </button>
        </Link>
      </div>
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)' }}>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Nome</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>CPF/CNPJ</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Email</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Telefone</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients?.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
            {clients?.map((client) => (
              <tr
                key={client.id}
                style={{ borderTop: '1px solid var(--color-neutral-300)' }}
              >
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{client.name}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', fontFamily: 'monospace' }}>{client.taxId}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: client.email ? 'inherit' : 'var(--color-neutral-600)' }}>{client.email ?? '—'}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: client.phone ? 'inherit' : 'var(--color-neutral-600)' }}>{client.phone ?? '—'}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to="/clients/$id/edit" params={{ id: client.id }}>
                      <button
                        style={{
                          background: 'var(--color-primary-bg)',
                          color: 'var(--color-primary)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Editar
                      </button>
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${client.name}"?`)) {
                            deleteMutation.mutate(client.id)
                          }
                        }}
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `client/src/features/clients/ClientFormPage.tsx`**

This component handles both `/clients/new` (create) and `/clients/$id/edit` (edit). It detects the mode via `useParams({ strict: false })`.

```typescript
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useClient, useCreateClient, useUpdateClient } from './hooks'
import type { CreateClientPayload } from './types'

type FormState = {
  name: string
  taxId: string
  nationalId: string
  address: string
  zipCode: string
  email: string
  phone: string
}

const empty: FormState = {
  name: '',
  taxId: '',
  nationalId: '',
  address: '',
  zipCode: '',
  email: '',
  phone: '',
}

export function ClientFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useClient(id ?? '', { enabled: isEdit })
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()

  const [form, setForm] = useState<FormState>(empty)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        taxId: existing.taxId,
        nationalId: existing.nationalId ?? '',
        address: existing.address ?? '',
        zipCode: existing.zipCode ?? '',
        email: existing.email ?? '',
        phone: existing.phone ?? '',
      })
    }
  }, [existing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Strip empty optional strings to undefined
    const payload: CreateClientPayload = {
      name: form.name,
      taxId: form.taxId,
      ...(form.nationalId && { nationalId: form.nationalId }),
      ...(form.address && { address: form.address }),
      ...(form.zipCode && { zipCode: form.zipCode }),
      ...(form.email && { email: form.email }),
      ...(form.phone && { phone: form.phone }),
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      void navigate({ to: '/clients' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'DUPLICATE_TAX_ID') {
        setServerError('CPF/CNPJ já está cadastrado.')
      } else {
        setServerError('Erro ao salvar cliente. Tente novamente.')
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    marginTop: 4,
    fontSize: '1rem',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }

  const labelTextStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--color-neutral-600)',
    fontWeight: 500,
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
      </h1>
      {serverError && (
        <p
          style={{
            color: 'var(--color-danger)',
            background: 'var(--color-danger-bg)',
            padding: 'var(--space-1)',
            borderRadius: 4,
            marginBottom: 'var(--space-2)',
          }}
        >
          {serverError}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <label style={labelStyle}>
          <span style={labelTextStyle}>Nome *</span>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>CPF / CNPJ *</span>
          <input
            style={inputStyle}
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            required
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>RG / Identidade</span>
          <input
            style={inputStyle}
            value={form.nationalId}
            onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Endereço</span>
          <input
            style={inputStyle}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>CEP</span>
          <input
            style={inputStyle}
            value={form.zipCode}
            onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Email</span>
          <input
            type="email"
            style={inputStyle}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Telefone</span>
          <input
            style={inputStyle}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/clients' })}
            style={{
              background: 'none',
              border: '1px solid var(--color-neutral-300)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Update `client/src/features/clients/index.ts`**

```typescript
export { ClientsListPage } from './ClientsListPage'
export { ClientFormPage } from './ClientFormPage'
```

- [ ] **Step 7: Update `client/src/router/index.tsx` — add client routes**

Replace the entire file:

```typescript
import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import axios from 'axios'
import { config } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ClientsListPage } from '@/features/clients/ClientsListPage'
import { ClientFormPage } from '@/features/clients/ClientFormPage'

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

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    clientsRoute,
    clientCreateRoute,
    clientEditRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /c/freela/constru-manager/client && npx tsc -p tsconfig.app.json --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
cd /c/freela/constru-manager && git add client/src/features/clients client/src/router/index.tsx && git commit -m "feat(client): add clients CRUD pages"
```

---

### Task 4: Products Feature — Types, API, Hooks, List Page, Form Page

**Files:**
- Create: `client/src/lib/format.ts`
- Create: `client/src/features/products/types.ts`
- Create: `client/src/features/products/api.ts`
- Create: `client/src/features/products/hooks.ts`
- Create: `client/src/features/products/ProductsListPage.tsx`
- Create: `client/src/features/products/ProductFormPage.tsx`
- Modify: `client/src/features/products/index.ts`
- Modify: `client/src/router/index.tsx`

- [ ] **Step 1: Create `client/src/lib/format.ts`**

```typescript
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}
```

- [ ] **Step 2: Create `client/src/features/products/types.ts`**

```typescript
export interface Product {
  id: string
  name: string
  basePrice: number      // cents (integer)
  markupPercent: number  // Prisma Decimal serialized as number
  finalPrice: number     // cents (integer), auto-computed by server
  unit: string | null
  minStock: number
  stockQty: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProductPayload {
  name: string
  basePrice: number      // cents
  markupPercent: number  // 0–99999.99
  unit?: string
  minStock?: number
}

export type UpdateProductPayload = Partial<CreateProductPayload>
```

- [ ] **Step 3: Create `client/src/features/products/api.ts`**

```typescript
import { api } from '@/lib/axios'
import type { Product, CreateProductPayload, UpdateProductPayload } from './types'

export async function listProducts(): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products')
  return data
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`)
  return data
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const { data } = await api.post<Product>('/products', payload)
  return data
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const { data } = await api.put<Product>(`/products/${id}`, payload)
  return data
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`)
}
```

- [ ] **Step 4: Create `client/src/features/products/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from './api'
import type { CreateProductPayload, UpdateProductPayload } from './types'

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: listProducts })
}

export function useProduct(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => getProduct(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => createProduct(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductPayload }) =>
      updateProduct(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}
```

- [ ] **Step 5: Create `client/src/features/products/ProductsListPage.tsx`**

```typescript
import { Link } from '@tanstack/react-router'
import { useProducts, useDeleteProduct } from './hooks'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/format'

export function ProductsListPage() {
  const { data: products, isLoading, error } = useProducts()
  const deleteMutation = useDeleteProduct()
  const { user } = useAuthStore()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar produtos.</p>

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Produtos</h1>
        {user?.role === 'ADMIN' && (
          <Link to="/products/new">
            <button
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-surface)',
                border: 'none',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Novo Produto
            </button>
          </Link>
        )}
      </div>
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)' }}>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Nome</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Un.</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Custo</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Markup</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Preço Final</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Estoque</th>
              {user?.role === 'ADMIN' && (
                <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {products?.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
            {products?.map((product) => (
              <tr key={product.id} style={{ borderTop: '1px solid var(--color-neutral-300)' }}>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{product.name}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: 'var(--color-neutral-600)' }}>{product.unit ?? '—'}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(product.basePrice)}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right' }}>{product.markupPercent}%</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(product.finalPrice)}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right' }}>{product.stockQty}</td>
                {user?.role === 'ADMIN' && (
                  <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to="/products/$id/edit" params={{ id: product.id }}>
                        <button
                          style={{
                            background: 'var(--color-primary-bg)',
                            color: 'var(--color-primary)',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Editar
                        </button>
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${product.name}"?`)) {
                            deleteMutation.mutate(product.id)
                          }
                        }}
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create `client/src/features/products/ProductFormPage.tsx`**

`basePrice` and `finalPrice` are in cents. The form displays values in BRL (divide by 100), converts to cents on submit. `finalPrice` is auto-computed by server — show it as a read-only preview.

```typescript
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useProduct, useCreateProduct, useUpdateProduct } from './hooks'
import type { CreateProductPayload } from './types'
import { formatCurrency } from '@/lib/format'

type FormState = {
  name: string
  basePriceBrl: string   // user input in BRL, e.g. "125.50"
  markupPercent: string  // user input, e.g. "20"
  unit: string
  minStock: string
}

const empty: FormState = {
  name: '',
  basePriceBrl: '',
  markupPercent: '0',
  unit: '',
  minStock: '0',
}

export function ProductFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useProduct(id ?? '', { enabled: isEdit })
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  const [form, setForm] = useState<FormState>(empty)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        basePriceBrl: (existing.basePrice / 100).toFixed(2),
        markupPercent: String(existing.markupPercent),
        unit: existing.unit ?? '',
        minStock: String(existing.minStock),
      })
    }
  }, [existing])

  // Preview finalPrice client-side: round(basePriceCents * (1 + markup/100))
  const basePriceCents = Math.round(parseFloat(form.basePriceBrl || '0') * 100)
  const markupNum = parseFloat(form.markupPercent || '0')
  const previewFinalPrice = isNaN(basePriceCents) || isNaN(markupNum)
    ? 0
    : Math.round(basePriceCents * (1 + markupNum / 100))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const basePrice = Math.round(parseFloat(form.basePriceBrl) * 100)
    const markupPercent = parseFloat(form.markupPercent)

    if (isNaN(basePrice) || basePrice < 0) {
      setServerError('Custo inválido.')
      return
    }
    if (isNaN(markupPercent) || markupPercent < 0) {
      setServerError('Markup inválido.')
      return
    }

    const payload: CreateProductPayload = {
      name: form.name,
      basePrice,
      markupPercent,
      ...(form.unit && { unit: form.unit }),
      ...(form.minStock && { minStock: parseInt(form.minStock, 10) }),
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      void navigate({ to: '/products' })
    } catch {
      setServerError('Erro ao salvar produto. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    marginTop: 4,
    fontSize: '1rem',
  }

  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }
  const labelTextStyle: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Produto' : 'Novo Produto'}
      </h1>
      {serverError && (
        <p style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: 'var(--space-1)', borderRadius: 4, marginBottom: 'var(--space-2)' }}>
          {serverError}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <label style={labelStyle}>
          <span style={labelTextStyle}>Nome *</span>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Custo (R$) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            style={inputStyle}
            value={form.basePriceBrl}
            onChange={(e) => setForm({ ...form, basePriceBrl: e.target.value })}
            required
            placeholder="0.00"
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Markup (%) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            style={inputStyle}
            value={form.markupPercent}
            onChange={(e) => setForm({ ...form, markupPercent: e.target.value })}
            required
          />
        </label>
        <div
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            padding: 'var(--space-1)',
            borderRadius: 4,
          }}
        >
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Preço final estimado: </span>
          <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(previewFinalPrice)}</strong>
        </div>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Unidade (ex: m², kg, un)</span>
          <input style={inputStyle} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="un" />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Estoque mínimo</span>
          <input type="number" min="0" style={inputStyle} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/products' })}
            style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Update `client/src/features/products/index.ts`**

```typescript
export { ProductsListPage } from './ProductsListPage'
export { ProductFormPage } from './ProductFormPage'
```

- [ ] **Step 8: Update `client/src/router/index.tsx` — add product routes**

Replace the entire file:

```typescript
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
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /c/freela/constru-manager/client && npx tsc -p tsconfig.app.json --noEmit
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
cd /c/freela/constru-manager && git add client/src/lib/format.ts client/src/features/products client/src/router/index.tsx && git commit -m "feat(client): add products CRUD pages with BRL price input"
```

---

### Task 5: Kits Feature — Types, API, Hooks, List Page, Form Page + Final Route Wiring

**Files:**
- Create: `client/src/features/kits/types.ts`
- Create: `client/src/features/kits/api.ts`
- Create: `client/src/features/kits/hooks.ts`
- Create: `client/src/features/kits/KitsListPage.tsx`
- Create: `client/src/features/kits/KitFormPage.tsx`
- Modify: `client/src/features/kits/index.ts`
- Modify: `client/src/router/index.tsx` (final version — adds kits routes)

- [ ] **Step 1: Create `client/src/features/kits/types.ts`**

```typescript
export interface KitItem {
  id: string
  productId: string
  quantity: number
  product: {
    id: string
    name: string
    finalPrice: number
    unit: string | null
  }
}

export interface Kit {
  id: string
  name: string
  totalPrice: number   // cents, sum of (item.product.finalPrice * item.quantity)
  isActive: boolean
  items: KitItem[]
  createdAt: string
  updatedAt: string
}

export interface KitItemPayload {
  productId: string
  quantity: number
}

export interface CreateKitPayload {
  name: string
  items: KitItemPayload[]   // min 1 item
}

export interface UpdateKitPayload {
  name?: string
  items?: KitItemPayload[]  // replaces all items when provided
}
```

- [ ] **Step 2: Create `client/src/features/kits/api.ts`**

```typescript
import { api } from '@/lib/axios'
import type { Kit, CreateKitPayload, UpdateKitPayload } from './types'

export async function listKits(): Promise<Kit[]> {
  const { data } = await api.get<Kit[]>('/kits')
  return data
}

export async function getKit(id: string): Promise<Kit> {
  const { data } = await api.get<Kit>(`/kits/${id}`)
  return data
}

export async function createKit(payload: CreateKitPayload): Promise<Kit> {
  const { data } = await api.post<Kit>('/kits', payload)
  return data
}

export async function updateKit(id: string, payload: UpdateKitPayload): Promise<Kit> {
  const { data } = await api.put<Kit>(`/kits/${id}`, payload)
  return data
}
```

- [ ] **Step 3: Create `client/src/features/kits/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listKits, getKit, createKit, updateKit } from './api'
import type { CreateKitPayload, UpdateKitPayload } from './types'

export function useKits() {
  return useQuery({ queryKey: ['kits'], queryFn: listKits })
}

export function useKit(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['kits', id],
    queryFn: () => getKit(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateKitPayload) => createKit(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kits'] }),
  })
}

export function useUpdateKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKitPayload }) =>
      updateKit(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kits'] }),
  })
}
```

- [ ] **Step 4: Create `client/src/features/kits/KitsListPage.tsx`**

```typescript
import { Link } from '@tanstack/react-router'
import { useKits } from './hooks'
import { formatCurrency } from '@/lib/format'

export function KitsListPage() {
  const { data: kits, isLoading, error } = useKits()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar kits.</p>

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Kits</h1>
        <Link to="/kits/new">
          <button
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Novo Kit
          </button>
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {kits?.length === 0 && (
          <p style={{ color: 'var(--color-neutral-600)' }}>Nenhum kit cadastrado.</p>
        )}
        {kits?.map((kit) => (
          <div
            key={kit.id}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-neutral-300)',
              borderRadius: 8,
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{kit.name}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                  {kit.items.length} {kit.items.length === 1 ? 'item' : 'itens'} ·{' '}
                  <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(kit.totalPrice)}</strong>
                </p>
              </div>
              <Link to="/kits/$id/edit" params={{ id: kit.id }}>
                <button
                  style={{
                    background: 'var(--color-primary-bg)',
                    color: 'var(--color-primary)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Editar
                </button>
              </Link>
            </div>
            <ul style={{ margin: '8px 0 0', padding: '0 0 0 var(--space-2)', fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
              {kit.items.map((item) => (
                <li key={item.id}>
                  {item.product.name} × {item.quantity}
                  {item.product.unit ? ` ${item.product.unit}` : ''} —{' '}
                  {formatCurrency(item.product.finalPrice * item.quantity)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `client/src/features/kits/KitFormPage.tsx`**

The kit form has a dynamic items list: user selects a product from a dropdown and sets the quantity. Items can be added and removed. The total price is computed live on the client using product `finalPrice` from the loaded products list.

```typescript
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useKit, useCreateKit, useUpdateKit } from './hooks'
import { useProducts } from '@/features/products/hooks'
import { formatCurrency } from '@/lib/format'
import type { KitItemPayload } from './types'

interface ItemRow {
  productId: string
  quantity: number
}

export function KitFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useKit(id ?? '', { enabled: isEdit })
  const { data: products } = useProducts()
  const createMutation = useCreateKit()
  const updateMutation = useUpdateKit()

  const [name, setName] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ productId: '', quantity: 1 }])
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setItems(
        existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      )
    }
  }, [existing])

  // Compute total price preview from current items and loaded product prices
  const productPriceMap = new Map(products?.map((p) => [p.id, p.finalPrice]) ?? [])
  const previewTotal = items.reduce((sum, row) => {
    const price = productPriceMap.get(row.productId) ?? 0
    return sum + price * row.quantity
  }, 0)

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: 1 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const validItems: KitItemPayload[] = items.filter(
      (row) => row.productId && row.quantity >= 1,
    )

    if (validItems.length === 0) {
      setServerError('Adicione pelo menos um item ao kit.')
      return
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload: { name, items: validItems } })
      } else {
        await createMutation.mutateAsync({ name, items: validItems })
      }
      void navigate({ to: '/kits' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'INVALID_PRODUCT') {
        setServerError('Um ou mais produtos não encontrados ou inativos.')
      } else {
        setServerError('Erro ao salvar kit. Tente novamente.')
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Kit' : 'Novo Kit'}
      </h1>
      {serverError && (
        <p style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: 'var(--space-1)', borderRadius: 4, marginBottom: 'var(--space-2)' }}>
          {serverError}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
            Nome do Kit *
          </span>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            Itens *
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((row, index) => (
              <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={row.productId}
                  onChange={(e) => updateItem(index, { productId: e.target.value })}
                  required
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Selecione um produto</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.finalPrice)}{p.unit ? ` / ${p.unit}` : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                  required
                  style={{ ...inputStyle, width: 80 }}
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{
                      background: 'var(--color-danger-bg)',
                      color: 'var(--color-danger)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            style={{
              marginTop: 8,
              background: 'none',
              border: '1px dashed var(--color-neutral-300)',
              padding: '6px var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--color-primary)',
              fontSize: '0.875rem',
              width: '100%',
            }}
          >
            + Adicionar item
          </button>
        </div>

        <div
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            padding: 'var(--space-1)',
            borderRadius: 4,
          }}
        >
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Total estimado: </span>
          <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(previewTotal)}</strong>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/kits' })}
            style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Update `client/src/features/kits/index.ts`**

```typescript
export { KitsListPage } from './KitsListPage'
export { KitFormPage } from './KitFormPage'
```

- [ ] **Step 7: Update `client/src/router/index.tsx` — final version with all routes**

Replace the entire file:

```typescript
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
```

- [ ] **Step 8: Final TypeScript compile — verify everything**

```bash
cd /c/freela/constru-manager/client && npx tsc -p tsconfig.app.json --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
cd /c/freela/constru-manager && git add client/src/features/kits client/src/router/index.tsx && git commit -m "feat(client): add kits CRUD pages with dynamic items form"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task | Status |
|---|---|---|
| accessToken stored in memory (not localStorage) | Task 1 — `authStore.ts` uses Zustand (in-memory) | ✓ |
| axios interceptor attaches Bearer token | Task 1 — `lib/axios.ts` request interceptor | ✓ |
| 401 → silent refresh → retry | Task 1 — response interceptor with queue | ✓ |
| Login page (email + password) | Task 2 — `LoginPage.tsx` | ✓ |
| Route guard (beforeLoad) | Task 2 — `router/index.tsx` | ✓ |
| Silent refresh on page reload | Task 2 — `beforeLoad` on `authenticatedRoute` | ✓ |
| App sidebar with role-based links | Task 2 — `AppLayout.tsx` | ✓ |
| Clients list (SALES + ADMIN) | Task 3 — `ClientsListPage.tsx` | ✓ |
| Clients create/edit form | Task 3 — `ClientFormPage.tsx` | ✓ |
| Client delete (ADMIN only — button visible only for ADMIN) | Task 3 — `ClientsListPage.tsx` user.role check | ✓ |
| DUPLICATE_TAX_ID error shown in form | Task 3 — `ClientFormPage.tsx` catch block | ✓ |
| Products list (SALES + ADMIN) | Task 4 — `ProductsListPage.tsx` | ✓ |
| Products create/edit (ADMIN only button visible) | Task 4 — `ProductsListPage.tsx` + form | ✓ |
| finalPrice preview in product form | Task 4 — `ProductFormPage.tsx` computed `previewFinalPrice` | ✓ |
| Kits list (ADMIN only — route is ADMIN-only on backend) | Task 5 — `KitsListPage.tsx` | ✓ |
| Kit create/edit with dynamic items | Task 5 — `KitFormPage.tsx` | ✓ |
| Kit total price preview | Task 5 — `KitFormPage.tsx` `previewTotal` | ✓ |
| INVALID_PRODUCT error shown in kit form | Task 5 — `KitFormPage.tsx` catch block | ✓ |
| Design tokens used (never hardcoded hex) | All tasks — `var(--color-*)`, `var(--space-*)` | ✓ |

### Placeholder Check

No TBDs, TODOs, or "similar to" references. All code blocks are complete.

### Type Consistency

- `AuthUser` defined in `lib/jwt.ts`, used in `authStore.ts` → consistent.
- `CreateClientPayload` / `UpdateClientPayload` defined in `clients/types.ts`, used in `clients/api.ts` and `clients/hooks.ts` → consistent.
- `CreateProductPayload` / `UpdateProductPayload` defined in `products/types.ts` → consistent.
- `CreateKitPayload` / `KitItemPayload` defined in `kits/types.ts` → consistent.
- `useProduct` called in `KitFormPage` — ✓ exported from `@/features/products/hooks`.
- `formatCurrency` used in tasks 4 and 5 — defined in Task 4's `lib/format.ts` ✓ (Task 5 depends on Task 4).
