import { useSyncExternalStore } from 'react'

import { BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY, NOTE_KEY, NOTES_KEY } from '@/constants/queryKeys'
import { queryClient } from '@/lib/queryClient'
import { isNative } from '@/platform/isNative'
import { loadToken } from '@/platform/secureStore'
import { outbox } from '@/sync/outbox'
import { pull } from '@/sync/pull'
import { push } from '@/sync/push'
import type { Note } from '@/types/api'


export type SyncState = 'synced' | 'syncing' | 'offline' | 'conflict' | 'error'

export interface SyncSnapshot {
  state: SyncState
  pendingCount: number
  conflicts: Note[]
  lastSyncedAt: number | null
}

let currentRunPromise: Promise<void> | null = null
let queuedRunPromise: Promise<void> | null = null

let currentSnapshot: SyncSnapshot = {
  state:        'synced',
  pendingCount: 0,
  conflicts:    [],
  lastSyncedAt: null,
}

const listeners = new Set<() => void>()

function updateSnapshot(updates: Partial<SyncSnapshot>) {
  currentSnapshot = { ...currentSnapshot, ...updates }
  listeners.forEach((listener) => listener())
}

async function doRun(): Promise<void> {
  if (!navigator.onLine) {
    const pending = await outbox.count().catch(() => 0)
    updateSnapshot({ state: 'offline', pendingCount: pending })
    return
  }

  const token = await loadToken().catch(() => null)
  if (!token) {
    updateSnapshot({ state: 'synced', pendingCount: 0 })
    return
  }

  try {
    const pending = await outbox.count().catch(() => 0)
    updateSnapshot({ state: 'syncing', pendingCount: pending })

    const { conflicts } = await push()

    if (conflicts.length > 0) {
      updateSnapshot({
        state:        'conflict',
        conflicts,
        pendingCount: await outbox.count().catch(() => 0),
      })
      return
    }

    await pull()

    void queryClient.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
    void queryClient.invalidateQueries({ queryKey: NOTES_KEY })
    void queryClient.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
    void queryClient.invalidateQueries({ queryKey: NOTE_KEY })

    updateSnapshot({
      state:        'synced',
      conflicts:    [],
      pendingCount: await outbox.count().catch(() => 0),
      lastSyncedAt: Date.now(),
    })
  } catch (err) {
    const isOnline = navigator.onLine
    updateSnapshot({
      state:        isOnline ? 'error' : 'offline',
      pendingCount: await outbox.count().catch(() => 0),
    })
    throw err
  }
}

export const syncEngine = {
  getSnapshot(): SyncSnapshot {
    return currentSnapshot
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  async run(): Promise<void> {
    if (!isNative()) return

    if (currentRunPromise) {
      if (!queuedRunPromise) {
        queuedRunPromise = currentRunPromise.then(() => doRun()).finally(() => {
          queuedRunPromise = null
        })
      }
      return queuedRunPromise
    }

    currentRunPromise = doRun().finally(() => {
      currentRunPromise = null
    })
    return currentRunPromise
  },

  start(): void {
    if (!isNative()) return

    void this.run().catch(() => {})

    window.addEventListener('online', () => {
      void this.run().catch(() => {})
    })

    window.addEventListener('offline', () => {
      void outbox.count().then((count) => {
        updateSnapshot({ state: 'offline', pendingCount: count })
      })
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.run().catch(() => {})
      }
    })

    // Periodic sync every 3 minutes while app runs
    setInterval(() => {
      void this.run().catch(() => {})
    }, 3 * 60 * 1000)
  },
}

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getSnapshot,
    syncEngine.getSnapshot,
  )
}
