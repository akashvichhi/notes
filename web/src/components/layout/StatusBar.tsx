import { memo, useMemo } from 'react'

import { Group, Text } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import type { SaveStatus } from '@/stores/uiStore'
import { useUiStore } from '@/stores/uiStore'

dayjs.extend(relativeTime)

export const StatusBar = memo(function StatusBar({
  status: propStatus,
  savedAt: propSavedAt,
  words = 0,
  folderPath = null,
  onRetry = () => {},
}: {
  status?: SaveStatus
  savedAt?: number | null
  words?: number
  folderPath?: string | null
  onRetry?: () => void
}) {
  const storeStatus = useUiStore((s) => s.saveStatus)
  const storeSavedAt = useUiStore((s) => s.savedAt)
  const editorStats = useUiStore((s) => s.editorStats)

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

  return (
    <Group gap="lg" h={28} px="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      {status === 'saving' && <Text c="dimmed" size="xs">Saving…</Text>}
      {status === 'saved' && savedAtText && (
        <Text c="dimmed" size="xs">Saved · {savedAtText}</Text>
      )}
      {status === 'error' && (
        <Text c="orange" size="xs" style={{ cursor: 'pointer' }} onClick={onRetry}>
          Couldn&apos;t save · retrying — Retry now
        </Text>
      )}

      <Text c="dimmed" size="xs" visibleFrom="sm">{statsText}</Text>
      {folderPath && <Text c="dimmed" size="xs" visibleFrom="sm">{folderPath}</Text>}
      <Text c="dimmed" ml="auto" size="xs">Autosave on</Text>
    </Group>
  )
})
