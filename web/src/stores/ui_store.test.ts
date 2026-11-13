import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '@src/types/api'

const platform: { native: boolean } = vi.hoisted((): { native: boolean } => ({ native: true }))

vi.mock('@src/platform/is_native', () => ({ isNative: (): boolean => platform.native }))

/** The starting container is read when the store is created, so each case loads a fresh copy. */
async function initialContainer(native: boolean): Promise<Container | undefined> {
  platform.native = native
  vi.resetModules()
  const { useUiStore } = await import('./ui_store')
  return useUiStore.getState().scope.container
}

describe('the starting container', () => {
  beforeEach(() => {
    platform.native = true
  })

  it('starts the browser on its Cloud notes', async () => {
    expect(await initialContainer(false)).toBe('cloud')
  })

  it('starts a native app on its device notes until the token is known', async () => {
    expect(await initialContainer(true)).toBe('local')
  })
})

describe('chooseStartingContainer', () => {
  it('opens a signed-in native app on its Cloud notes', async () => {
    vi.resetModules()
    const { chooseStartingContainer, useUiStore } = await import('./ui_store')

    chooseStartingContainer(true)

    expect(useUiStore.getState().scope.container).toBe('cloud')
  })
})
