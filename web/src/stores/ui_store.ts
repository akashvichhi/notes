import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

export type TView = 'folders' | 'list' | 'editor'
export type TSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

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
  filter:               string
  /** The list the filter was typed in (its URL): another list starts unfiltered. */
  filterScopeKey:       string
  saveStatus:           TSaveStatus
  savedAt:              number | null
  editorStats:          IEditorStats | null
  retrySave:            (() => Promise<void> | void) | null
  cancelPendingSave:    (() => void) | null
  setView:              (v: TView) => void
  toggleNav:            () => void
  closeNav:             () => void
  toggleList:           () => void
  setFilter:            (filter: string, scopeKey: string) => void
  clearFilter:          () => void
  setSaveStatus:        (saveStatus: TSaveStatus, savedAt?: number | null) => void
  setEditorStats:       (editorStats: IEditorStats | null) => void
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => void
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => void
}

export const useUiStore: UseBoundStore<StoreApi<IUiState>> = create<IUiState>((set: StoreApi<IUiState>['setState']): IUiState => ({
  view:              'list',
  navOpen:           false,
  listCollapsed:     false,
  filter:            '',
  filterScopeKey:    '',
  saveStatus:        'idle',
  savedAt:           null,
  editorStats:       null,
  retrySave:         null,
  cancelPendingSave: null,
  setView:           (view: TView) => set({ view }),
  toggleNav:         () => set((s: IUiState) => ({ navOpen: !s.navOpen })),
  closeNav:          () => set({ navOpen: false }),
  toggleList:        () => set((s: IUiState) => ({ listCollapsed: !s.listCollapsed })),
  setFilter:         (filter: string, filterScopeKey: string) => set({ filter, filterScopeKey }),
  clearFilter:       () => set({ filter: '', filterScopeKey: '' }),
  setSaveStatus:     (saveStatus: TSaveStatus, savedAt: number | null | undefined) =>
    set((s: IUiState) => ({ saveStatus, savedAt: savedAt !== undefined ? savedAt : s.savedAt })),
  setEditorStats:       (editorStats: IEditorStats | null) => set({ editorStats }),
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => set({ retrySave }),
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => set({ cancelPendingSave }),
}))
