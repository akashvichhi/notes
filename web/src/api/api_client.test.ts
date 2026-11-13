import { AxiosError, type AxiosResponse, HttpStatusCode, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { api, type ApiError, normalizeError } from './api_client'

vi.mock('@src/platform/is_native', () => ({ isNative: (): boolean => false }))

function failingAdapter(status: number, data: object): (config: InternalAxiosRequestConfig) => Promise<never> {
  return async (config: InternalAxiosRequestConfig): Promise<never> => {
    const response: AxiosResponse = { status, data, statusText: '', headers: {}, config }
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response)
  }
}

describe('normalizeError', () => {
  it('reads the server copy from a 409, which the API sends unwrapped', () => {
    const conflict: unknown = {
      response: { status: 409, data: { message: 'Changed', server_copy: { uuid: 'n1', version: 3 } } },
    }

    expect(normalizeError(conflict).serverCopy).toEqual({ uuid: 'n1', version: 3 })
  })

  it('reports a network failure as status 0', () => {
    expect(normalizeError(new Error('Network Error')).status).toBe(0)
  })

  it('returns an error that is already normalised unchanged', () => {
    const error: ApiError = { status: HttpStatusCode.Conflict, message: 'Changed', serverCopy: undefined }

    expect(normalizeError(error)).toEqual(error)
  })
})

describe('api', () => {
  it('rejects with an ApiError, so callers never see raw axios errors', async () => {
    const request: Promise<unknown> = api.get('/notes', {
      adapter: failingAdapter(HttpStatusCode.UnprocessableEntity, { message: 'The title is too long.' }),
    })

    await expect(request).rejects.toEqual({
      status:     HttpStatusCode.UnprocessableEntity,
      message:    'The title is too long.',
      errors:     undefined,
      serverCopy: undefined,
    })
  })
})
