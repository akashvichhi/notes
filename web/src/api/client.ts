import axios, { type AxiosInstance } from 'axios'
import type { Note } from '@/types/api'

export interface ApiError {
  status: number
  message: string
  errors?: Record<string, string[]>
  serverCopy?: Note
}

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
  // Required since axios 1.6: without it the X-XSRF-TOKEN header is not
  // attached and every write returns 419 CSRF token mismatch.
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

let csrfPrimed = false

export async function ensureCsrf(): Promise<void> {
  if (csrfPrimed) return
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
  csrfPrimed = true
}

export function normalizeError(e: unknown): ApiError {
  const err = e as { response?: { status: number; data?: Record<string, unknown> }; message?: string }

  if (!err.response) {
    return { status: 0, message: err.message ?? 'Network error' }
  }

  const data = err.response.data ?? {}
  const serverCopy = (data.server_copy as { data?: Note } | undefined)?.data

  return {
    status: err.response.status,
    message: (data.message as string) ?? 'Request failed',
    errors: data.errors as Record<string, string[]> | undefined,
    serverCopy,
  }
}

// 419 means the CSRF cookie expired: re-prime it and retry exactly once.
api.interceptors.response.use(undefined, async (error) => {
  const status = error?.response?.status
  const config = error?.config

  if (status === 419 && config && !config.__retried) {
    config.__retried = true
    csrfPrimed = false
    await ensureCsrf()
    return api.request(config)
  }

  return Promise.reject(error)
})
