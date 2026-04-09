export interface AuthUser {
  userId: string
  role: 'ADMIN' | 'SALES' | 'FINANCE'
}

export function decodeToken(token: string): AuthUser {
  try {
    const base64url = token.split('.')[1]
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64)) as {
      userId: string
      role: string
    }
    if (!payload.userId || !payload.role) {
      throw new Error('Token payload missing required fields')
    }
    return {
      userId: payload.userId,
      role: payload.role as AuthUser['role'],
    }
  } catch {
    throw new Error('Invalid token')
  }
}
