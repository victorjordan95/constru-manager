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
