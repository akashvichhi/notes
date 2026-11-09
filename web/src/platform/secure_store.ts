import { invoke } from '@tauri-apps/api/core'

import { isNative } from './is_native'

/**
 * The native apps' API token, kept in the OS secure store (decision 1). It is
 * never written where JavaScript storage could leak it; this module keeps it in
 * memory only for the life of the window.
 */

// Older builds also copied the token into localStorage. Removed on first load, so it doesn't linger.
const LEGACY_LOCAL_STORAGE_KEY: string = 'notes_desktop_token'

let cached: string | null = null

function removeLegacyCopy(): void {
  try {
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY)
  } catch {
    // Storage can be unavailable; there is then nothing to remove.
  }
}

export async function saveToken(token: string): Promise<void> {
  if (!isNative()) return
  cached = token
  try {
    await invoke('save_token', { token })
  } catch (err) {
    console.error('Failed to save the token to the OS secure store:', err)
  }
}

export async function loadToken(): Promise<string | null> {
  if (!isNative()) return null
  if (cached) return cached

  removeLegacyCopy()

  try {
    cached = await invoke<string | null>('load_token')
  } catch (err) {
    console.error('Failed to load the token from the OS secure store:', err)
  }

  return cached
}

export async function deleteToken(): Promise<void> {
  if (!isNative()) return
  cached = null
  removeLegacyCopy()
  try {
    await invoke('delete_token')
  } catch (err) {
    console.error('Failed to delete the token from the OS secure store:', err)
  }
}
