import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OutboxItem } from './outbox'

vi.mock('@src/platform/is_native', () => ({ isNative: (): boolean => false }))

const DOC_A: { type: 'doc'; content: [] } = { type: 'doc', content: [] }
const DOC_B: { type: 'doc'; content: { type: string }[] } = { type: 'doc', content: [{ type: 'paragraph' }] }

describe('outbox', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('removes an op once it has been sent', async () => {
    const { outbox } = await import('./outbox')
    await outbox.enqueue({ kind: 'trash', uuid: 'n1', container: 'cloud' })
    const [sent] = await outbox.pending()

    await outbox.complete(sent as OutboxItem)

    expect(await outbox.pending()).toEqual([])
  })

  it('keeps an edit merged while its save was in flight, at the new version', async () => {
    const { outbox } = await import('./outbox')
    await outbox.enqueue({ kind: 'body', uuid: 'n1', body: DOC_A, version: 1, container: 'cloud' })
    const [inFlight] = await outbox.pending()
    await outbox.enqueue({ kind: 'body', uuid: 'n1', body: DOC_B, version: 1, container: 'cloud' })

    const removed: boolean = await outbox.complete(inFlight as OutboxItem, 2)

    expect(removed).toBe(false)
    expect(await outbox.pending()).toEqual([
      expect.objectContaining({ kind: 'body', uuid: 'n1', body: DOC_B, version: 2 }),
    ])
  })
})
