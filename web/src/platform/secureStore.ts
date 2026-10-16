import { invoke } from '@tauri-apps/api/core'

import { isNative } from './isNative'

const LOCAL_STORAGE_KEY = 'notes_desktop_token'
let cached: string | null = null

export async function saveToken(token: string): Promise<void> {
  if (!isNative()) return
  cached = token
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, token)
  } catch {
    // Ignore storage quota/permission errors
  }
  try {
    await invoke('save_token', { token })
  } catch (err) {
    console.warn('Failed to save token to OS keychain:', err)
  }
}

export async function loadToken(): Promise<string | null> {
  if (!isNative()) return null
  if (cached) return cached

  // Check localStorage first for instant availability across reloads
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (local) {
      cached = local
      return local
    }
  } catch {
    // Ignore
  }

  try {
    const keychainToken = await invoke<string | null>('load_token')
    if (keychainToken) {
      cached = keychainToken
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, keychainToken)
      } catch {
        // Ignore
      }
      return keychainToken
    }
  } catch (err) {
    console.warn('Failed to load token from OS keychain:', err)
  }

  return null
}

export async function deleteToken(): Promise<void> {
  if (!isNative()) return
  cached = null
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch {
    // Ignore
  }
  try {
    await invoke('delete_token')
  } catch (err) {
    console.warn('Failed to delete token from OS keychain:', err)
  }
}

