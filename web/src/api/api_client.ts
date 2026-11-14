import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig, isAxiosError } from 'axios'

import { API_URL, IS_DEV } from '@src/config/env'
import { MESSAGES } from '@src/constants/messages'
import type { INote } from '@src/types/api'
import { snakeToCamel, toCamelCaseKeys, toSnakeCaseKeys } from '@src/utils/case_conversion'

export interface IApiError {
  status:      number
  message:     string
  /** Messages per form field, under the field's camelCase name. */
  errors?:     Record<string, string[]>
  serverCopy?: INote
}

/** One entry of an error's `details`, after the response keys were converted. */
interface IErrorDetail {
  field:   string
  message: string
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
})

interface IErrorWithResponse {
  response?: { status: number; data?: unknown }
}

function isApiError(e: unknown): e is IApiError {
  return typeof e === 'object' && e !== null && !('response' in e) && !('isAxiosError' in e)
    && typeof (e as IApiError).status === 'number' && typeof (e as IApiError).message === 'string'
}

function isErrorDetail(value: unknown): value is IErrorDetail {
  return typeof value === 'object' && value !== null
    && typeof (value as IErrorDetail).field === 'string' && typeof (value as IErrorDetail).message === 'string'
}

/** The field names in `details` are values, so the key conversion left them in snake_case. */
function fieldErrors(details: unknown): Record<string, string[]> | undefined {
  if (!Array.isArray(details)) return undefined
  const errors: Record<string, string[]> = {}
  for (const detail of details.filter(isErrorDetail)) {
    const field: string = snakeToCamel(detail.field)
    errors[field] = [...(errors[field] ?? []), detail.message]
  }
  return Object.keys(errors).length > 0 ? errors : undefined
}

/**
 * Turns any failure into an IApiError. The client already rejects with one, so
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

  // Responses that reach the interceptor are already camelCase; converting again is harmless.
  const data: Record<string, unknown> = (toCamelCaseKeys(err.response.data ?? {}) ?? {}) as Record<string, unknown>

  return {
    status:     err.response.status,
    message:    typeof data.error === 'string' ? data.error : MESSAGES.REQUEST_FAILED,
    errors:     fieldErrors(data.details),
    // A lost version race carries the note as it now is.
    serverCopy: data.serverCopy as INote | undefined,
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  config.data = toSnakeCaseKeys(config.data)
  config.params = toSnakeCaseKeys(config.params)
  return config
})

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    response.data = toCamelCaseKeys(response.data)
    return response
  },
  async (error: unknown): Promise<never> => Promise.reject(normalizeError(error)),
)
