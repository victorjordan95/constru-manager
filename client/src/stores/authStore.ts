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
