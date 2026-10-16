import { memo, useMemo } from 'react'

import { Group, Text, UnstyledButton } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { useSyncStatus } from '@/hooks/useSyncStatus'
import { deviceKind } from '@/platform/deviceKind'
import { isNative } from '@/platform/isNative'
import type { SaveStatus } from '@/stores/uiStore'
import { useUiStore } from '@/stores/uiStore'
import type { Container } from '@/types/api'

dayjs.extend(relativeTime)

export const StatusBar = memo(function StatusBar({
  status: propStatus,
  savedAt: propSavedAt,
  words = 0,
  folderPath = null,
  container,
  onRetry,
}: {
  status?: SaveStatus
  savedAt?: number | null
  words?: number
  folderPath?: string | null
  container?: Container
  onRetry?: () => void
}) {
  const storeStatus = useUiStore((s) => s.saveStatus)
  const storeSavedAt = useUiStore((s) => s.savedAt)
  const editorStats = useUiStore((s) => s.editorStats)
  const storeRetry = useUiStore((s) => s.retrySave)
  const syncStatus = useSyncStatus()
  const native = isNative()

  const handleRetry = onRetry ?? (storeRetry ? () => storeRetry() : undefined)

  const status = propStatus ?? storeStatus
  const savedAt = propSavedAt ?? storeSavedAt

  const savedAtText = useMemo(() => {
    return savedAt ? dayjs(savedAt).fromNow() : null
  }, [savedAt])

  const statsText = useMemo(() => {
    if (editorStats) {
      const { words: w, characters: c, selectedWords: sw, selectedCharacters: sc } = editorStats
      if (sc > 0) {
        return `${sw} of ${w} words · ${sc} of ${c} characters selected`
      }
      return `${w} words · ${c} characters`
    }
    return `${words} words`
  }, [editorStats, words])

  const syncText = useMemo(() => {
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

      <Text c="dimmed" size="xs" visibleFrom="sm">{statsText}</Text>
      {folderPath && <Text c="dimmed" size="xs" visibleFrom="sm">{folderPath}</Text>}
      <Text c="dimmed" ml="auto" size="xs">{syncText}</Text>
    </Group>
  )
})
