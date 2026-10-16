import { invoke } from '@tauri-apps/api/core'

import { isNative } from './isNative'

let cached: string | null = null

export async function saveToken(token: string): Promise<void> {
  if (!isNative()) return
  cached = token
  await invoke('save_token', { token })
}

export async function loadToken(): Promise<string | null> {
  if (!isNative()) return null
  if (cached) return cached
  cached = await invoke<string | null>('load_token')
  return cached
}

export async function deleteToken(): Promise<void> {
  if (!isNative()) return
  cached = null
  await invoke('delete_token')
}
