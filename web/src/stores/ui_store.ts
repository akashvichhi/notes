import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

import { ALL_NOTES_LABEL } from '@src/constants/labels'
import type { TUuid } from '@src/types/api'


export type TView = 'folders' | 'list' | 'editor'
export type TSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type TScope =
  | { kind: 'all'; label: string }
  | { kind: 'starred'; label: string }
  | { kind: 'trash'; label: string }
  | { kind: 'folder'; uuid: TUuid; label: string }
  | { kind: 'tag'; slug: string; label: string }
  | { kind: 'search'; q: string; label: string }

export interface IEditorStats {
  words:              number
  characters:         number
  selectedWords:      number
  selectedCharacters: number
}

export interface IUiState {
  view:                 TView
  navOpen:              boolean
  listCollapsed:        boolean
  scope:                TScope
  filter:               string
  saveStatus:           TSaveStatus
  savedAt:              number | null
  editorStats:          IEditorStats | null
  retrySave:            (() => Promise<void> | void) | null
  cancelPendingSave:    (() => void) | null
  setView:              (v: TView) => void
  toggleNav:            () => void
  closeNav:             () => void
  toggleList:           () => void
  setScope:             (s: TScope) => void
  setFilter:            (f: string) => void
  setSaveStatus:        (saveStatus: TSaveStatus, savedAt?: number | null) => void
  setEditorStats:       (editorStats: IEditorStats | null) => void
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => void
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => void
}

export const useUiStore: UseBoundStore<StoreApi<IUiState>> = create<IUiState>((set: StoreApi<IUiState>['setState']): IUiState => ({
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
  setView:           (view: TView) => set({ view }),
  toggleNav:         () => set((s: IUiState) => ({ navOpen: !s.navOpen })),
  closeNav:          () => set({ navOpen: false }),
  toggleList:        () => set((s: IUiState) => ({ listCollapsed: !s.listCollapsed })),
  // Changing scope always clears the filter: a sticky filter makes notes
  // look deleted.
  setScope:          (scope: TScope) =>
    set({ scope, filter: '' }),
  setFilter:     (filter: string) => set({ filter }),
  setSaveStatus: (saveStatus: TSaveStatus, savedAt: number | null | undefined) =>
    set((s: IUiState) => ({ saveStatus, savedAt: savedAt !== undefined ? savedAt : s.savedAt })),
  setEditorStats:       (editorStats: IEditorStats | null) => set({ editorStats }),
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => set({ retrySave }),
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => set({ cancelPendingSave }),
}))
