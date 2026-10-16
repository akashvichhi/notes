import { clear, del, get, set } from 'idb-keyval'

import type { ProseMirrorDoc, UUID } from '@/types/api'

export interface Draft { doc: ProseMirrorDoc; savedAt: number }

const key = (uuid: UUID) => `note-draft:${uuid}`

/** Written on every keystroke so a crash or reload never loses typing. */
export async function saveDraft(uuid: UUID, doc: ProseMirrorDoc): Promise<void> {
  try {
    await set(key(uuid), { doc, savedAt: Date.now() } satisfies Draft)
  } catch {
    // Private windows and blocked site data throw. A missing draft must never
    // break editing.
  }
}

export async function loadDraft(uuid: UUID): Promise<Draft | null> {
  try {
    return (await get<Draft>(key(uuid))) ?? null
  } catch {
    return null
  }
}

export async function clearDraft(uuid: UUID): Promise<void> {
  try { await del(key(uuid)) } catch { /* ignore */ }
}

export async function clearAllDrafts(): Promise<void> {
  try { await clear() } catch { /* ignore */ }
}

