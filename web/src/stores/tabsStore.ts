import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { UUID } from '@/types/api'

export interface Tab { uuid: UUID; title: string; dirty: boolean }

interface TabsState {
  tabs: Tab[]
  activeUuid: UUID | null
  closed: Tab[]
  open: (uuid: UUID, title: string) => void
  close: (uuid: UUID) => void
  closeOthers: (uuid: UUID) => void
  closeAll: () => void
  reopen: () => void
  setDirty: (uuid: UUID, dirty: boolean) => void
  setTitle: (uuid: UUID, title: string) => void
  activate: (uuid: UUID) => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs:       [],
      activeUuid: null,
      closed:     [],

      open: (uuid, title) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.uuid === uuid)
        if (existing) {
          const nextTitle = title && (!existing.title || existing.title === 'Untitled') ? title : existing.title
          set({
            tabs:       tabs.map((t) => (t.uuid === uuid ? { ...t, title: nextTitle } : t)),
            activeUuid: uuid,
          })
          return
        }
        set({ tabs: [...tabs, { uuid, title: title || 'Untitled', dirty: false }], activeUuid: uuid })
      },

      close: (uuid) => {
        const { tabs, activeUuid, closed } = get()
        const index = tabs.findIndex((t) => t.uuid === uuid)
        if (index === -1) return

        const removed = tabs[index]!
        const next = tabs.filter((t) => t.uuid !== uuid)
        const neighbour = next[index - 1] ?? next[index] ?? null

        set({
          tabs:       next,
          activeUuid: activeUuid === uuid ? neighbour?.uuid ?? null : activeUuid,
          closed:     [...closed, removed].slice(-10),
        })
      },

      closeOthers: (uuid) =>
        set((s) => ({ tabs: s.tabs.filter((t) => t.uuid === uuid), activeUuid: uuid })),

      closeAll: () => set({ tabs: [], activeUuid: null }),

      reopen: () => {
        const { closed } = get()
        const last = closed[closed.length - 1]
        if (!last) return
        set({ closed: closed.slice(0, -1) })
        get().open(last.uuid, last.title)
      },

      setDirty: (uuid, dirty) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.uuid === uuid ? { ...t, dirty } : t)) })),

      setTitle: (uuid, title) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.uuid === uuid ? { ...t, title } : t)) })),

      activate: (uuid) => set({ activeUuid: uuid }),
    }),
    // Per device, never synced: tabs are window state, not user data.
    { name: 'notes.tabs' },
  ),
)
