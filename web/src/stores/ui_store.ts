import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

import { ALL_NOTES_LABEL } from '@src/constants/labels'
import { isNative } from '@src/platform/is_native'
import type { Container, UUID } from '@src/types/api'


export type View = 'folders' | 'list' | 'editor'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type Scope =
  | { kind: 'all'; container?: Container; label: string }
  | { kind: 'starred'; container?: Container; label: string }
  | { kind: 'trash'; container?: Container; label: string }
  | { kind: 'folder'; container?: Container; uuid: UUID; label: string }
  | { kind: 'tag'; container?: Container; slug: string; label: string }
  | { kind: 'search'; container?: Container; q: string; label: string }

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

// The token is read asynchronously from the OS secure store, so a native app
// starts on its device notes; chooseStartingContainer() switches once it is known.
function getInitialContainer(): Container {
  return isNative() ? 'local' : 'cloud'
}

export const useUiStore: UseBoundStore<StoreApi<UiState>> = create<UiState>((set: StoreApi<UiState>['setState']): UiState => ({
  view:              'list',
  navOpen:           false,
  listCollapsed:     false,
  scope:             { kind: 'all', container: getInitialContainer(), label: ALL_NOTES_LABEL },
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
    set((s: UiState) => ({
      scope: {
        ...scope,
        container: scope.container ?? (s.scope as { container?: Container }).container ?? 'cloud',
      } as Scope,
      filter: '',
    })),
  setFilter:     (filter: string) => set({ filter }),
  setSaveStatus: (saveStatus: SaveStatus, savedAt: number | null | undefined) =>
    set((s: UiState) => ({ saveStatus, savedAt: savedAt !== undefined ? savedAt : s.savedAt })),
  setEditorStats:       (editorStats: EditorStats | null) => set({ editorStats }),
  setRetrySave:         (retrySave: (() => Promise<void> | void) | null) => set({ retrySave }),
  setCancelPendingSave: (cancelPendingSave: (() => void) | null) => set({ cancelPendingSave }),
}))

/** Opens a signed-in native app on its Cloud notes, unless the user already picked a view. */
export function chooseStartingContainer(signedIn: boolean): void {
  const { scope, setScope } = useUiStore.getState()
  if (!signedIn || scope.kind !== 'all' || scope.container === 'cloud') return
  setScope({ ...scope, container: 'cloud' })
}
