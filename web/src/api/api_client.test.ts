import { AxiosError, type AxiosResponse, HttpStatusCode, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'

import { MESSAGES } from '@src/constants/messages'

import { api, type IApiError, normalizeError } from './api_client'

type TAdapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>

function failingAdapter(status: number, data: object): (config: InternalAxiosRequestConfig) => Promise<never> {
  return async (config: InternalAxiosRequestConfig): Promise<never> => {
    const response: AxiosResponse = { status, data, statusText: '', headers: {}, config }
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response)
  }
}

function answeringAdapter(data: object, seen: InternalAxiosRequestConfig[] = []): TAdapter {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    seen.push(config)
    return { status: HttpStatusCode.Ok, data, statusText: '', headers: {}, config }
  }
}

describe('normalizeError', () => {
  it('reads the server copy from a 409, which the API sends next to the error', () => {
    const conflict: unknown = {
      response: { status: 409, data: { error: 'Changed', server_copy: { uuid: 'n1', version: 3, title_locked: true } } },
    }

    expect(normalizeError(conflict)).toEqual({
      status:     409,
      message:    'Changed',
      errors:     undefined,
      serverCopy: { uuid: 'n1', version: 3, titleLocked: true },
    })
  })

  it('puts the details of a 422 under the camelCase name of each field', () => {
    const invalid: unknown = {
      response: {
        status: 422,
        data:   {
          error:   'Validation failed.',
          details: [
            { field: 'current_password', message: 'The current password is incorrect.' },
            { field: 'name', message: 'The name field is required.' },
            { field: 'name', message: 'The name is too long.' },
          ],
        },
      },
    }

    expect(normalizeError(invalid).errors).toEqual({
      currentPassword: ['The current password is incorrect.'],
      name:            ['The name field is required.', 'The name is too long.'],
    })
  })

  it('reports a network failure as status 0', () => {
    expect(normalizeError(new Error('Network Error')).status).toBe(0)
  })

  it('says the server could not be reached when a request got no response', () => {
    const offline: AxiosError = new AxiosError('Network Error', AxiosError.ERR_NETWORK)

    expect(normalizeError(offline)).toEqual({ status: 0, message: MESSAGES.NETWORK_ERROR })
  })

  it('never shows the text of an error thrown by our own code', () => {
    const internal: Error = new Error('UNIQUE constraint failed: notes.uuid')

    expect(normalizeError(internal).message).toBe(MESSAGES.UNEXPECTED_ERROR)
  })

  it('falls back to a generic message when the server sends none', () => {
    expect(normalizeError({ response: { status: 500, data: {} } }).message).toBe(MESSAGES.REQUEST_FAILED)
  })

  it('returns an error that is already normalised unchanged', () => {
    const error: IApiError = { status: HttpStatusCode.Conflict, message: 'Changed', serverCopy: undefined }

    expect(normalizeError(error)).toEqual(error)
  })
})

describe('api', () => {
  it('rejects with an ApiError, so callers never see raw axios errors', async () => {
    const request: Promise<unknown> = api.get('/notes', {
      adapter: failingAdapter(HttpStatusCode.UnprocessableEntity, { error: 'The title is too long.' }),
    })

    await expect(request).rejects.toEqual({
      status:     HttpStatusCode.UnprocessableEntity,
      message:    'The title is too long.',
      errors:     undefined,
      serverCopy: undefined,
    })
  })

  it('gives the app camelCase keys and leaves a note body as stored', async () => {
    const body: object = { type: 'doc', content: [{ type: 'paragraph', attrs: { text_align: 'center' } }] }

    const response: AxiosResponse = await api.get('/notes/n1', {
      adapter: answeringAdapter({ data: { is_starred: true, body } }),
    })

    expect(response.data).toEqual({ data: { isStarred: true, body } })
  })

  it('sends snake_case keys in the body and the query string', async () => {
    const seen: InternalAxiosRequestConfig[] = []

    await api.post('/notes', { folderId: 'f1' }, { params: { perPage: 20 }, adapter: answeringAdapter({}, seen) })

    const config: InternalAxiosRequestConfig | undefined = seen[0]
    expect(JSON.parse(String(config?.data))).toEqual({ folder_id: 'f1' })
    expect(config?.params).toEqual({ per_page: 20 })
  })
})
