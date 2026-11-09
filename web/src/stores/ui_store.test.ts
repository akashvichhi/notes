import { describe, expect, it, vi } from 'vitest'

import { chooseStartingContainer, useUiStore } from './ui_store'

vi.mock('@src/platform/is_native', () => ({ isNative: (): boolean => true }))

describe('chooseStartingContainer', () => {
  it('opens a signed-in native app on its Cloud notes', () => {
    chooseStartingContainer(true)

    expect(useUiStore.getState().scope.container).toBe('cloud')
  })
})
