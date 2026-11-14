import { clear, del, get, set } from 'idb-keyval'

import type { TProseMirrorDoc, TUuid } from '@src/types/api'

export interface IDraft { doc: TProseMirrorDoc; savedAt: number }

const key: (uuid: TUuid) => string = (uuid: TUuid): string => `note-draft:${uuid}`

/** Written on every keystroke so a crash or reload never loses typing. */
export async function saveDraft(uuid: TUuid, doc: TProseMirrorDoc): Promise<void> {
  try {
    await set(key(uuid), { doc, savedAt: Date.now() } satisfies IDraft)
  } catch {
    // Private windows and blocked site data throw. A missing draft must never
    // break editing.
  }
}

export async function loadDraft(uuid: TUuid): Promise<IDraft | null> {
  try {
    return (await get<IDraft>(key(uuid))) ?? null
  } catch {
    return null
  }
}

export async function clearDraft(uuid: TUuid): Promise<void> {
  try { await del(key(uuid)) } catch { /* ignore */ }
}

export async function clearAllDrafts(): Promise<void> {
  try { await clear() } catch { /* ignore */ }
}

