import axios, { type AxiosInstance } from 'axios'

import { API_URL, IS_DEV } from '@src/config/env'
import { isNative } from '@src/platform/is_native'
import { loadToken } from '@src/platform/secure_store'
import type { Note } from '@src/types/api'

export interface ApiError {
  status:      number
  message:     string
  errors?:     Record<string, string[]>
  serverCopy?: Note
}

const getBaseUrl = (): string => {
  // In browser development, always route through Vite's proxy (relative path)
  // so requests are same-origin and proxy to whatever VITE_API_URL is configured to.
  if (IS_DEV && !isNative()) {
    return ''
  }
  return API_URL
}

export const api: AxiosInstance = axios.create({
  baseURL:         getBaseUrl() + '/api/v1',
  headers:         { Accept: 'application/json' },
  // Cookies are for the browser build only. A packaged app is a different
  // origin, so SameSite cookies are never sent and these flags do nothing.
  withCredentials: !isNative(),
  withXSRFToken:   !isNative(),
})

api.interceptors.request.use(async (config) => {
  if (isNative()) {
    const token = await loadToken()
    if (token) {
      if (typeof config.headers?.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  }
  return config
})


let csrfPrimed = false

export async function ensureCsrf(): Promise<void> {
  if (isNative() || csrfPrimed) return
  await axios.get(getBaseUrl() + '/sanctum/csrf-cookie', { withCredentials: true })
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
    status:  err.response.status,
    message: (data.message as string) ?? 'Request failed',
    errors:  data.errors as Record<string, string[]> | undefined,
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
