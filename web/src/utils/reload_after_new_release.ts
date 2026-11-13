import { RELEASE_RELOAD_KEY, RELEASE_RELOAD_WINDOW_MS } from '@src/constants/reload_constants'

/**
 * A lazy chunk that fails to load usually means a new release replaced it.
 * Reloads once to fetch the new files; returns false, without reloading, when
 * it already reloaded moments ago, so an offline app can't loop.
 */
export function reloadAfterNewRelease(storage: Storage, reload: () => void, now: number): boolean {
  const last: number = Number(storage.getItem(RELEASE_RELOAD_KEY) ?? 0)
  if (now - last < RELEASE_RELOAD_WINDOW_MS) return false

  storage.setItem(RELEASE_RELOAD_KEY, String(now))
  reload()
  return true
}

/** Reloads the real page; storage access can throw in private windows. */
export function reloadPageAfterNewRelease(): boolean {
  try {
    return reloadAfterNewRelease(window.sessionStorage, (): void => window.location.reload(), Date.now())
  } catch {
    return false
  }
}
