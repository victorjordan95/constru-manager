import axios from 'axios'
import type { AxiosError } from 'axios'
import { config } from '@/config/env'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'

// Augment Axios config to include _retry sentinel for 401-refresh logic
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

// Callback set by App.tsx to redirect without a full page reload.
// Falls back to window.location if not yet initialized (e.g. during tests).
let _navigateToLogin: (() => void) | null = null
export function setNavigateToLogin(fn: () => void) {
  _navigateToLogin = fn
}

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
    const axiosError = error as AxiosError
    const orig = axiosError.config
    if (!orig || axiosError.response?.status !== 401 || orig._retry) {
      return Promise.reject(error)
    }
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => queue.push({ resolve, reject })).then(
        (t) => {
          orig.headers.Authorization = `Bearer ${t}`
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
      orig.headers.Authorization = `Bearer ${accessToken}`
      return api(orig)
    } catch (e) {
      processQueue(e, null)
      useAuthStore.getState().clearAuth()
      _navigateToLogin ? _navigateToLogin() : (window.location.href = '/login')
      return Promise.reject(e)
    } finally {
      isRefreshing = false
    }
  },
)
