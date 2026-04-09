export interface AuthUser {
  userId: string
  role: 'ADMIN' | 'SALES' | 'FINANCE'
}

export function decodeToken(token: string): AuthUser {
  const base64url = token.split('.')[1]
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(base64)) as {
    userId: string
    role: string
  }
  return {
    userId: payload.userId,
    role: payload.role as AuthUser['role'],
  }
}
