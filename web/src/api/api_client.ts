import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig, isAxiosError } from 'axios'

import { API_URL, IS_DEV } from '@src/config/env'
import { MESSAGES } from '@src/constants/messages'
import type { INote } from '@src/types/api'

export interface IApiError {
  status:      number
  message:     string
  errors?:     Record<string, string[]>
  serverCopy?: INote
}

const getBaseUrl: () => string = (): string => {
  // In development, always route through Vite's proxy (relative path)
  // so requests are same-origin and proxy to whatever VITE_API_URL is configured to.
  if (IS_DEV) {
    return ''
  }
  return API_URL
}

export const api: AxiosInstance = axios.create({
  baseURL:         getBaseUrl() + '/api/v1',
  headers:         { Accept: 'application/json' },
  withCredentials: true,
  withXSRFToken:   true,
})

/** A request the CSRF retry has already re-sent once. */
interface IRetriableConfig extends InternalAxiosRequestConfig { __retried?: boolean }

let csrfPrimed: boolean = false

export async function ensureCsrf(): Promise<void> {
  if (csrfPrimed) return
  await axios.get(getBaseUrl() + '/sanctum/csrf-cookie', { withCredentials: true })
  csrfPrimed = true
}

interface IErrorWithResponse {
  response?: { status: number; data?: Record<string, unknown> }
}

function isApiError(e: unknown): e is IApiError {
  return typeof e === 'object' && e !== null && !('response' in e) && !('isAxiosError' in e)
    && typeof (e as IApiError).status === 'number' && typeof (e as IApiError).message === 'string'
}

/**
 * Turns any failure into an ApiError. The client already rejects with one, so
 * this is a no-op for API calls; it covers errors thrown by other code.
 */
export function normalizeError(e: unknown): IApiError {
  if (isApiError(e)) return e

  const err: IErrorWithResponse = e as IErrorWithResponse

  // Without a response the text comes from axios or our own code and may
  // hold internals, so the user gets a fixed message.
  if (!err.response) {
    return { status: 0, message: isAxiosError(e) ? MESSAGES.NETWORK_ERROR : MESSAGES.UNEXPECTED_ERROR }
  }

  const data: Record<string, unknown> = err.response.data ?? {}
  // The API sends the conflicting note unwrapped: `{ message, server_copy: {...note} }`.
  const serverCopy: INote | undefined = data.server_copy as INote | undefined

  return {
    status:  err.response.status,
    message: typeof data.message === 'string' ? data.message : MESSAGES.REQUEST_FAILED,
    errors:  data.errors as Record<string, string[]> | undefined,
    serverCopy,
  }
}

// 419 means the CSRF cookie expired: re-prime it and retry exactly once.
api.interceptors.response.use(undefined, async (error: unknown): Promise<AxiosResponse> => {
  const status: number | undefined = isAxiosError(error) ? error.response?.status : undefined
  const config: IRetriableConfig | undefined = isAxiosError(error) ? error.config : undefined

  if (status === 419 && config && !config.__retried) {
    config.__retried = true
    csrfPrimed = false
    await ensureCsrf()
    return api.request(config)
  }

  return Promise.reject(normalizeError(error))
})
