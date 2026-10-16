import { create } from 'zustand'

import { ALL_NOTES_LABEL } from '@/constants/labels'
import { isNative } from '@/platform/isNative'
import type { UUID } from '@/types/api'


export type View = 'folders' | 'list' | 'editor'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type Container = 'cloud' | 'local'

export type Scope =
  | { kind: 'all'; container?: Container; label: string }
  | { kind: 'starred'; container?: Container; label: string }
  | { kind: 'trash'; container?: Container; label: string }
  | { kind: 'folder'; container?: Container; uuid: UUID; label: string }
  | { kind: 'tag'; container?: Container; slug: string; label: string }
  | { kind: 'search'; container?: Container; q: string; label: string }

export interface EditorStats {
  words: number
  characters: number
  selectedWords: number
  selectedCharacters: number
}

interface UiState {
  view: View
  navOpen: boolean
  listCollapsed: boolean
  scope: Scope
  filter: string
  saveStatus: SaveStatus
  savedAt: number | null
  editorStats: EditorStats | null
  retrySave: (() => Promise<void> | void) | null
  cancelPendingSave: (() => void) | null
  setView: (v: View) => void
  toggleNav: () => void
  closeNav: () => void
  toggleList: () => void
  setScope: (s: Scope) => void
  setFilter: (f: string) => void
  setSaveStatus: (saveStatus: SaveStatus, savedAt?: number | null) => void
  setEditorStats: (editorStats: EditorStats | null) => void
  setRetrySave: (retrySave: (() => Promise<void> | void) | null) => void
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => void
}

function getInitialContainer(): Container {
  if (!isNative()) return 'cloud'
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('notes_desktop_token')) {
      return 'cloud'
    }
  } catch {
    // Ignore
  }
  return 'local'
}

export const useUiStore = create<UiState>((set) => ({
  view:              'list',
  navOpen:           true,
  listCollapsed:     false,
  scope:             { kind: 'all', container: getInitialContainer(), label: ALL_NOTES_LABEL },
  filter:            '',
  saveStatus:        'idle',
  savedAt:           null,
  editorStats:       null,
  retrySave:         null,
  cancelPendingSave: null,
  setView:           (view) => set({ view }),
  toggleNav:         () => set((s) => ({ navOpen: !s.navOpen })),
  closeNav:          () => set({ navOpen: false }),
  toggleList:        () => set((s) => ({ listCollapsed: !s.listCollapsed })),
  // Changing scope always clears the filter: a sticky filter makes notes
  // look deleted.
  setScope:          (scope) =>
    set((s) => ({
      scope: {
        ...scope,
        container: scope.container ?? (s.scope as { container?: Container }).container ?? 'cloud',
      } as Scope,
      filter: '',
    })),
  setFilter:     (filter) => set({ filter }),
  setSaveStatus: (saveStatus, savedAt) =>
    set((s) => ({ saveStatus, savedAt: savedAt !== undefined ? savedAt : s.savedAt })),
  setEditorStats:       (editorStats) => set({ editorStats }),
  setRetrySave:         (retrySave) => set({ retrySave }),
  setCancelPendingSave: (cancelPendingSave) => set({ cancelPendingSave }),
}))
