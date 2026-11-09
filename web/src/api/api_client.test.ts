import { describe, expect, it } from 'vitest'

import { normalizeError } from './api_client'

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
})
