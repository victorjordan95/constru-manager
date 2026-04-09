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
