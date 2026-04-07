# Phase 2 — Auth Design

**Date:** 2026-04-07  
**Project:** constru-manager (SSD v1.5)  
**Scope:** Authentication endpoints, JWT middleware, RBAC middleware

---

## Context

Builds on Phase 1 foundation. All secrets already validated by `config/env.ts` (Zod). Adds four auth endpoints, two middlewares, and a rate limiter. No auto-registration — users are created by ADMIN only.

---

## 1. Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | ADMIN | Create a new user (admin-only) |
| `POST` | `/auth/login` | Public | Returns access token, sets refresh token as HttpOnly cookie |
| `POST` | `/auth/refresh` | Public (cookie) | Exchange refresh token for new access token |
| `POST` | `/auth/logout` | Authenticated | Invalidate refresh token (blacklist + clear cookie) |

---

## 2. JWT Flow

```
Login
  → validate email + password (bcrypt, 12 rounds)
  → sign accessToken  (JWT, 15m, JWT_ACCESS_SECRET)
  → sign refreshToken (JWT, 7d,  JWT_REFRESH_SECRET)
  → return { accessToken } in body
  → set refreshToken as HttpOnly cookie

Authenticated request
  → client sends: Authorization: Bearer <accessToken>
  → authenticate middleware validates JWT, injects req.user = { userId, role }

Access token expired
  → POST /auth/refresh with cookie
  → server validates refreshToken (not blacklisted, valid JWT)
  → returns new { accessToken }

Logout
  → add refreshToken to in-memory blacklist (Set<string>)
  → clear refreshToken cookie
```

---

## 3. Token Storage

- **Access token:** returned in response body; stored in client memory (never localStorage)
- **Refresh token:** HttpOnly cookie, `sameSite: 'strict'`, `secure: true` in production, `path: '/auth'` (scoped to auth routes only)
- **Blacklist:** in-memory `Set<string>` in `auth.service.ts` — does not persist across server restarts (acceptable for MVP)

---

## 4. Rate Limiting

- Package: `express-rate-limit`
- Applied only to `POST /auth/login`
- Config: max 5 requests per 15 minutes per IP
- Response on limit: `{ error: "Too many login attempts. Try again in 15 minutes.", code: "RATE_LIMITED" }`

---

## 5. RBAC

Two middlewares, always used together on protected routes:

```typescript
// authenticate: validates JWT, injects req.user
router.get('/clients', authenticate, authorize('ADMIN', 'SALES'), listClients)

// authorize: checks role membership, returns 403 if not authorized
router.delete('/clients/:id', authenticate, authorize('ADMIN'), deleteClient)
```

- `authenticate` is stateless — reads the Bearer token, verifies signature, injects `req.user`
- `authorize(...roles)` is a factory returning a middleware — must be called after `authenticate`
- Backend always re-validates role from JWT — never trusts client-sent role values

---

## 6. Request / Response Shapes

### POST /auth/register (ADMIN only)
```
Body:    { email: string, password: string, role: 'ADMIN' | 'SALES' | 'FINANCE' }
Success: 201 { id, email, role, createdAt }
Errors:  400 EMAIL_TAKEN | 400 VALIDATION_ERROR | 403 FORBIDDEN
```

### POST /auth/login
```
Body:    { email: string, password: string }
Success: 200 { accessToken: string }
         + Set-Cookie: refreshToken=<jwt>; HttpOnly; SameSite=Strict; Path=/auth/refresh
Errors:  401 INVALID_CREDENTIALS | 429 RATE_LIMITED
```

### POST /auth/refresh
```
Cookie:  refreshToken=<jwt>
Success: 200 { accessToken: string }
Errors:  401 INVALID_TOKEN | 401 TOKEN_EXPIRED | 401 TOKEN_BLACKLISTED
```

### POST /auth/logout
```
Header:  Authorization: Bearer <accessToken>
Cookie:  refreshToken=<jwt>
Success: 204 (no body)
         + clears refreshToken cookie
Errors:  401 UNAUTHORIZED
```

---

## 7. File Structure

```
server/src/
├── features/
│   └── auth/
│       ├── auth.controller.ts   ← route handlers (thin, delegates to service)
│       ├── auth.service.ts      ← business logic: bcrypt, JWT, blacklist
│       ├── auth.routes.ts       ← Express router + rate limiter wired
│       └── auth.types.ts        ← JwtPayload, AuthenticatedRequest
├── middlewares/
│   ├── authenticate.ts          ← validates Bearer token, injects req.user
│   └── authorize.ts             ← RBAC factory middleware
```

`auth.routes.ts` is registered in `app.ts` at `/auth`.

---

## 8. Security Rules (from spec §2.2)

- bcrypt salt rounds: 12 (never lower)
- JWT secrets: read from `env.ts` — never hardcoded
- Refresh token: HttpOnly cookie only — never in response body
- Stack traces: never exposed in production (handled by existing `errorHandler`)
- Role: always read from decoded JWT server-side — never trust client-provided role
- Failed login rate limit: 5 attempts / 15 min / IP

---

## 9. Dependencies to Install

- `express-rate-limit` — login rate limiting
- `cookie-parser` — parse HttpOnly cookies in Express

---

## Deliverables Checklist

- [ ] `features/auth/auth.types.ts` — JwtPayload, AuthenticatedRequest
- [ ] `features/auth/auth.service.ts` — bcrypt, JWT sign/verify, blacklist
- [ ] `features/auth/auth.controller.ts` — register, login, refresh, logout handlers
- [ ] `features/auth/auth.routes.ts` — router with rate limiter
- [ ] `middlewares/authenticate.ts` — Bearer JWT validation
- [ ] `middlewares/authorize.ts` — RBAC factory
- [ ] `app.ts` updated — mount `/auth` router, add cookie-parser
- [ ] Tests: login success/fail, refresh, logout, RBAC middleware
