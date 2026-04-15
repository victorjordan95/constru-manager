# Users Management Design

## Goal

Add a user management UI for ADMIN users: list all users, create new users, and deactivate existing ones.

## Architecture

New `users` feature following the existing pattern (clients, products, kits). Server exposes `GET /users` and `PATCH /users/:id/deactivate` under a dedicated router. Client has `UsersListPage` (table + deactivate) and `UserFormPage` (create form). User creation reuses the existing `POST /auth/register` endpoint.

**Tech Stack:** Express + Prisma (server), React + TanStack Query + TanStack Router (client), TypeScript

---

## Server

### New files

**`server/src/features/users/users.controller.ts`**

Two handlers:

- `listUsers` — `prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id, email, role, isActive, createdAt } })` → `200 []`
- `deactivateUser` — reads `:id` from params, checks the target user is not the currently logged-in user (returns `400` with `code: 'CANNOT_DEACTIVATE_SELF'` if so), sets `isActive = false` via `prisma.user.update`, returns updated user `{ id, email, role, isActive, createdAt }`

**`server/src/features/users/users.routes.ts`**

```
GET  /users               authenticate + authorize('ADMIN')  → listUsers
PATCH /users/:id/deactivate  authenticate + authorize('ADMIN')  → deactivateUser
```

### Modified files

**`server/src/server.ts`** — mount `usersRouter` at `/users`

---

## Client

### New files

**`client/src/features/users/api.ts`**

- `getUsers(): Promise<User[]>` — `GET /users`
- `deactivateUser(id: string): Promise<User>` — `PATCH /users/:id/deactivate`

Types:
```ts
export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'FINANCE';
  isActive: boolean;
  createdAt: string;
}
```

**`client/src/features/users/hooks.ts`**

- `useUsers()` — `useQuery({ queryKey: ['users'], queryFn: getUsers })`
- `useDeactivateUser()` — `useMutation({ mutationFn: deactivateUser, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }) })`

**`client/src/features/users/UsersListPage.tsx`**

Table columns: Email, Papel, Status, Data de cadastro, Ações

- Status column: badge "Ativo" (green) / "Inativo" (gray)
- Ações column: "Desativar" button — disabled if `!user.isActive` or if `user.id === loggedInUser.id`
- "Desativar" triggers `window.confirm()` before calling mutation
- Per-row loading state (same pattern as FinanceDashboardPage)
- "+ Novo Usuário" button → navigate to `/users/new`

**`client/src/features/users/UserFormPage.tsx`**

Form fields:
- Email (`type="email"`, required)
- Senha (`type="password"`, required, min 8 chars — validated client-side)
- Papel (`<select>`: ADMIN / SALES / FINANCE)

Submit calls `POST /auth/register` via `registerUser()` in `api.ts`. On success, navigates to `/users`. Shows server errors (email já cadastrado → `EMAIL_TAKEN`). Disabled submit button with "Salvando..." while pending.

**`client/src/features/users/api.ts`** also exports:
- `registerUser(data: { email, password, role }): Promise<User>` — `POST /auth/register`

### Modified files

**`client/src/layouts/AppLayout.tsx`** — add "Usuários" link (ADMIN only), after Kits and before Orçamentos

**`client/src/router/index.tsx`** — add routes:
- `/users` → `UsersListPage`
- `/users/new` → `UserFormPage`

---

## Access control

| Rota | Papel |
|------|-------|
| `GET /users` | ADMIN |
| `PATCH /users/:id/deactivate` | ADMIN |
| `/users` (UI) | ADMIN |
| `/users/new` (UI) | ADMIN |

---

## Error handling

| Situação | Comportamento |
|----------|---------------|
| Email já cadastrado | Server retorna `EMAIL_TAKEN` → exibe "Email já está em uso" no form |
| Desativar próprio usuário | Server retorna `CANNOT_DEACTIVATE_SELF` → não chega ao server (botão desabilitado no client) |
| Usuário não encontrado | Server retorna `404` |
