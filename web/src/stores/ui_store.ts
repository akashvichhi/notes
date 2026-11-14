import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

import { ALL_NOTES_LABEL } from '@src/constants/labels'
import type { UUID } from '@src/types/api'


export type View = 'folders' | 'list' | 'editor'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type Scope =
  | { kind: 'all'; label: string }
  | { kind: 'starred'; label: string }
  | { kind: 'trash'; label: string }
  | { kind: 'folder'; uuid: UUID; label: string }
  | { kind: 'tag'; slug: string; label: string }
  | { kind: 'search'; q: string; label: string }

export interface EditorStats {
  words:              number
  characters:         number
  selectedWords:      number
  selectedCharacters: number
}

export interface UiState {
  view:                 View
  navOpen:              boolean
  listCollapsed:        boolean
  scope:                Scope
  filter:               string
  saveStatus:           SaveStatus
  savedAt:              number | null
  editorStats:          EditorStats | null
  retrySave:            (() => Promise<void> | void) | null
  cancelPendingSave:    (() => void) | null
  setView:              (v: View) => void
  toggleNav:            () => void
  closeNav:             () => void
  toggleList:           () => void
  setScope:             (s: Scope) => void
  setFilter:            (f: string) => void
  setSaveStatus:        (saveStatus: SaveStatus, savedAt?: number | null) => void
  setEditorStats:       (editorStats: EditorStats | null) => void
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => void
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => void
}

export const useUiStore: UseBoundStore<StoreApi<UiState>> = create<UiState>((set: StoreApi<UiState>['setState']): UiState => ({
  view:              'list',
  navOpen:           false,
  listCollapsed:     false,
  scope:             { kind: 'all', label: ALL_NOTES_LABEL },
  filter:            '',
  saveStatus:        'idle',
  savedAt:           null,
  editorStats:       null,
  retrySave:         null,
  cancelPendingSave: null,
  setView:           (view: View) => set({ view }),
  toggleNav:         () => set((s: UiState) => ({ navOpen: !s.navOpen })),
  closeNav:          () => set({ navOpen: false }),
  toggleList:        () => set((s: UiState) => ({ listCollapsed: !s.listCollapsed })),
  // Changing scope always clears the filter: a sticky filter makes notes
  // look deleted.
  setScope:          (scope: Scope) =>
    set({ scope, filter: '' }),
  setFilter:     (filter: string) => set({ filter }),
  setSaveStatus: (saveStatus: SaveStatus, savedAt: number | null | undefined) =>
    set((s: UiState) => ({ saveStatus, savedAt: savedAt !== undefined ? savedAt : s.savedAt })),
  setEditorStats:       (editorStats: EditorStats | null) => set({ editorStats }),
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => set({ retrySave }),
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => set({ cancelPendingSave }),
}))
