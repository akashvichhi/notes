import { memo, useMemo } from 'react'

import { Group, Text, UnstyledButton } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { deviceKind } from '@src/platform/device_kind'
import { isNative } from '@src/platform/is_native'
import { useUiStore } from '@src/stores/ui_store'
import type { EditorStats, SaveStatus, UiState } from '@src/stores/ui_store'
import { useSyncStatus } from '@src/sync/engine'
import type { SyncSnapshot } from '@src/sync/engine'
import type { Container } from '@src/types/api'

dayjs.extend(relativeTime)

export interface IStatusBarProps {
  status?:     SaveStatus
  savedAt?:    number | null
  words?:      number
  folderPath?: string | null
  container?:  Container
  onRetry?:    () => void
}

export const StatusBar: React.NamedExoticComponent<IStatusBarProps> = memo(function StatusBar({
  status: propStatus,
  savedAt: propSavedAt,
  words = 0,
  folderPath = null,
  container,
  onRetry,
}: IStatusBarProps): React.JSX.Element {
  const storeStatus: SaveStatus = useUiStore((s: UiState) => s.saveStatus)
  const storeSavedAt: number | null = useUiStore((s: UiState) => s.savedAt)
  const editorStats: EditorStats | null = useUiStore((s: UiState) => s.editorStats)
  const storeRetry: (() => Promise<void> | void) | null = useUiStore((s: UiState) => s.retrySave)
  const syncStatus: SyncSnapshot = useSyncStatus()
  const native: boolean = isNative()

  const handleRetry: (() => void) | undefined = onRetry ?? (storeRetry ? (): void | Promise<void> => storeRetry() : undefined)

  const status: SaveStatus = propStatus ?? storeStatus
  const savedAt: number | null = propSavedAt ?? storeSavedAt

  const savedAtText: string | null = useMemo(() => {
    return savedAt ? dayjs(savedAt).fromNow() : null
  }, [savedAt])

  const statsText: string = useMemo(() => {
    if (editorStats) {
      const { words: w, characters: c, selectedWords: sw, selectedCharacters: sc } = editorStats
      if (sc > 0) {
        return `${sw} of ${w} words · ${sc} of ${c} characters selected`
      }
      return `${w} words · ${c} characters`
    }
    return `${words} words`
  }, [editorStats, words])

  const syncText: string = useMemo(() => {
    if (!native) return 'Autosave on'
    if (container === 'local') {
      return `On ${deviceKind().noun} — not backed up`
    }
    if (syncStatus.state === 'syncing') {
      return 'Syncing…'
    }
    if (syncStatus.state === 'offline') {
      return syncStatus.pendingCount > 0
        ? `Offline — ${syncStatus.pendingCount} changes pending`
        : 'Offline'
    }
    if (syncStatus.state === 'conflict') {
      return `${syncStatus.conflicts.length} note(s) need attention`
    }
    if (syncStatus.state === 'synced') {
      return syncStatus.lastSyncedAt
        ? `Synced ${dayjs(syncStatus.lastSyncedAt).fromNow()}`
        : 'Synced'
    }
    return 'Autosave on'
  }, [native, container, syncStatus])

  return (
    <Group gap="lg" h={28} px="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      {status === 'saving' && <Text c="dimmed" size="xs">Saving…</Text>}
      {status === 'saved' && savedAtText && (
        <Text c="dimmed" size="xs">Saved · {savedAtText}</Text>
      )}
      {status === 'error' && (
        <UnstyledButton aria-label="Retry saving note" style={{ cursor: 'pointer' }} onClick={handleRetry}>
          <Text c="orange" size="xs">
            Couldn&apos;t save · retrying — Retry now
          </Text>
        </UnstyledButton>
      )}

      <Text c="dimmed" size="xs">{statsText}</Text>
      {folderPath && <Text c="dimmed" size="xs">{folderPath}</Text>}
      <Text c="dimmed" ml="auto" size="xs">{syncText}</Text>
    </Group>
  )
})
