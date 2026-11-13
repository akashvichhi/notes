import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import type { UUID } from '@src/types/api'

export interface Tab { uuid: UUID; title: string; dirty: boolean }

export interface TabsState {
  tabs:        Tab[]
  activeUuid:  UUID | null
  closed:      Tab[]
  open:        (uuid: UUID, title: string) => void
  close:       (uuid: UUID) => void
  closeOthers: (uuid: UUID) => void
  closeAll:    () => void
  reopen:      () => void
  setDirty:    (uuid: UUID, dirty: boolean) => void
  setTitle:    (uuid: UUID, title: string) => void
  activate:    (uuid: UUID) => void
}

export const useTabsStore: UseBoundStore<StoreApi<TabsState>> = create<TabsState>()(
  persist<TabsState>(
    (set: StoreApi<TabsState>['setState'], get: () => TabsState): TabsState => ({
      tabs:       [],
      activeUuid: null,
      closed:     [],

      open: (uuid: string, title: string): void => {
        const { tabs } = get()
        const existing: Tab | undefined = tabs.find((t: Tab) => t.uuid === uuid)
        if (existing) {
          const nextTitle: string = title && (!existing.title || existing.title === DEFAULT_NOTE_TITLE || existing.title === 'Untitled') ? title : existing.title
          set({
            tabs:       tabs.map((t: Tab) => (t.uuid === uuid ? { ...t, title: nextTitle } : t)),
            activeUuid: uuid,
          })
          return
        }
        set({ tabs: [...tabs, { uuid, title: title || DEFAULT_NOTE_TITLE, dirty: false }], activeUuid: uuid })
      },

      close: (uuid: string): void => {
        const { tabs, activeUuid, closed } = get()
        const index: number = tabs.findIndex((t: Tab) => t.uuid === uuid)
        if (index === -1) {
          if (activeUuid === uuid) {
            set({ activeUuid: null })
          }
          return
        }

        const removed: Tab = tabs[index]!
        const next: Tab[] = tabs.filter((t: Tab) => t.uuid !== uuid)
        const neighbour: Tab | null = next[index - 1] ?? next[index] ?? null

        set({
          tabs:       next,
          activeUuid: activeUuid === uuid ? neighbour?.uuid ?? null : activeUuid,
          closed:     [...closed, removed].slice(-10),
        })
      },

      closeOthers: (uuid: string) =>
        set((s: TabsState) => ({ tabs: s.tabs.filter((t: Tab) => t.uuid === uuid), activeUuid: uuid })),

      closeAll: () => set({ tabs: [], activeUuid: null, closed: [] }),

      reopen: (): void => {
        const { closed } = get()
        const last: Tab | undefined = closed[closed.length - 1]
        if (!last) return
        set({ closed: closed.slice(0, -1) })
        get().open(last.uuid, last.title)
      },

      setDirty: (uuid: string, dirty: boolean) =>
        set((s: TabsState) => ({ tabs: s.tabs.map((t: Tab) => (t.uuid === uuid ? { ...t, dirty } : t)) })),

      setTitle: (uuid: string, title: string) =>
        set((s: TabsState) => ({ tabs: s.tabs.map((t: Tab) => (t.uuid === uuid ? { ...t, title } : t)) })),

      activate: (uuid: string) => set({ activeUuid: uuid }),
    }),
    // Per device, never synced: tabs are window state, not user data.
    { name: 'notes.tabs' },
  ),
)
