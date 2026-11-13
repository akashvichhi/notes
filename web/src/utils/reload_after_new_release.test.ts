import { describe, expect, it, vi } from 'vitest'

import { reloadAfterNewRelease } from './reload_after_new_release'

const NOW: number = Date.parse('2026-11-13T09:00:00Z')

function memoryStorage(): Storage {
  const values: Map<string, string> = new Map<string, string>()
  return {
    getItem:    (key: string): string | null => values.get(key) ?? null,
    setItem:    (key: string, value: string): void => { values.set(key, value) },
    removeItem: (key: string): void => { values.delete(key) },
    clear:      (): void => values.clear(),
    key:        (): string | null => null,
    get length(): number { return values.size },
  }
}

describe('reloadAfterNewRelease', () => {
  it('reloads once to pick up a new release', () => {
    const reload: () => void = vi.fn()

    expect(reloadAfterNewRelease(memoryStorage(), reload, NOW)).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload again straight after a reload, so it cannot loop', () => {
    const storage: Storage = memoryStorage()
    const reload: () => void = vi.fn()
    reloadAfterNewRelease(storage, reload, NOW)

    expect(reloadAfterNewRelease(storage, reload, NOW + 1_000)).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })
})
