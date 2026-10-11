import { create } from 'zustand'
import type { UUID } from '@/types/api'

export type View = 'folders' | 'list' | 'editor'

export type Scope =
  | { kind: 'all'; label: string }
  | { kind: 'starred'; label: string }
  | { kind: 'trash'; label: string }
  | { kind: 'folder'; uuid: UUID; label: string }
  | { kind: 'tag'; slug: string; label: string }
  | { kind: 'search'; q: string; label: string }

interface UiState {
  view: View
  navOpen: boolean
  listCollapsed: boolean
  scope: Scope
  filter: string
  setView: (v: View) => void
  toggleNav: () => void
  closeNav: () => void
  toggleList: () => void
  setScope: (s: Scope) => void
  setFilter: (f: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  view: 'list',
  navOpen: false,
  listCollapsed: false,
  scope: { kind: 'all', label: 'All notes' },
  filter: '',
  setView: (view) => set({ view }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
  closeNav: () => set({ navOpen: false }),
  toggleList: () => set((s) => ({ listCollapsed: !s.listCollapsed })),
  // Changing scope always clears the filter: a sticky filter makes notes
  // look deleted.
  setScope: (scope) => set({ scope, filter: '' }),
  setFilter: (filter) => set({ filter }),
}))
