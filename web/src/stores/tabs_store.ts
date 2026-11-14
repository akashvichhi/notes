import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import type { TUuid } from '@src/types/api'

export interface ITab { uuid: TUuid; title: string; dirty: boolean }

export interface ITabsState {
  tabs:        ITab[]
  activeUuid:  TUuid | null
  closed:      ITab[]
  open:        (uuid: TUuid, title: string) => void
  close:       (uuid: TUuid) => void
  closeOthers: (uuid: TUuid) => void
  closeAll:    () => void
  reopen:      () => void
  setDirty:    (uuid: TUuid, dirty: boolean) => void
  setTitle:    (uuid: TUuid, title: string) => void
  activate:    (uuid: TUuid) => void
}

export const useTabsStore: UseBoundStore<StoreApi<ITabsState>> = create<ITabsState>()(
  persist<ITabsState>(
    (set: StoreApi<ITabsState>['setState'], get: () => ITabsState): ITabsState => ({
      tabs:       [],
      activeUuid: null,
      closed:     [],

      open: (uuid: string, title: string): void => {
        const { tabs } = get()
        const existing: ITab | undefined = tabs.find((t: ITab) => t.uuid === uuid)
        if (existing) {
          const nextTitle: string = title && (!existing.title || existing.title === DEFAULT_NOTE_TITLE || existing.title === 'Untitled') ? title : existing.title
          set({
            tabs:       tabs.map((t: ITab) => (t.uuid === uuid ? { ...t, title: nextTitle } : t)),
            activeUuid: uuid,
          })
          return
        }
        set({ tabs: [...tabs, { uuid, title: title || DEFAULT_NOTE_TITLE, dirty: false }], activeUuid: uuid })
      },

      close: (uuid: string): void => {
        const { tabs, activeUuid, closed } = get()
        const index: number = tabs.findIndex((t: ITab) => t.uuid === uuid)
        if (index === -1) {
          if (activeUuid === uuid) {
            set({ activeUuid: null })
          }
          return
        }

        const removed: ITab = tabs[index]!
        const next: ITab[] = tabs.filter((t: ITab) => t.uuid !== uuid)
        const neighbour: ITab | null = next[index - 1] ?? next[index] ?? null

        set({
          tabs:       next,
          activeUuid: activeUuid === uuid ? neighbour?.uuid ?? null : activeUuid,
          closed:     [...closed, removed].slice(-10),
        })
      },

      closeOthers: (uuid: string) =>
        set((s: ITabsState) => ({ tabs: s.tabs.filter((t: ITab) => t.uuid === uuid), activeUuid: uuid })),

      closeAll: () => set({ tabs: [], activeUuid: null, closed: [] }),

      reopen: (): void => {
        const { closed } = get()
        const last: ITab | undefined = closed[closed.length - 1]
        if (!last) return
        set({ closed: closed.slice(0, -1) })
        get().open(last.uuid, last.title)
      },

      setDirty: (uuid: string, dirty: boolean) =>
        set((s: ITabsState) => ({ tabs: s.tabs.map((t: ITab) => (t.uuid === uuid ? { ...t, dirty } : t)) })),

      setTitle: (uuid: string, title: string) =>
        set((s: ITabsState) => ({ tabs: s.tabs.map((t: ITab) => (t.uuid === uuid ? { ...t, title } : t)) })),

      activate: (uuid: string) => set({ activeUuid: uuid }),
    }),
    // Per device, never synced: tabs are window state, not user data.
    { name: 'notes.tabs' },
  ),
)
