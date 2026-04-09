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
