import { Group, Text } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { memo, useMemo } from 'react'

import type { SaveStatus } from '@/hooks/useAutosave'

dayjs.extend(relativeTime)

export const StatusBar = memo(function StatusBar({
  status = 'idle',
  savedAt = null,
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
  const savedAtText = useMemo(() => {
    return savedAt ? dayjs(savedAt).fromNow() : null
  }, [savedAt])

  return (
    <Group gap="lg" h={28} px="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      {/* No spinner: autosave fires every ~800ms and a spinner that often is noise. */}
      {status === 'saving' && <Text c="dimmed" size="xs">Saving…</Text>}
      {status === 'saved' && savedAtText && (
        <Text c="dimmed" size="xs">Saved · {savedAtText}</Text>
      )}
      {status === 'error' && (
        <Text c="orange" size="xs" style={{ cursor: 'pointer' }} onClick={onRetry}>
          Couldn&apos;t save · retrying — Retry now
        </Text>
      )}

      <Text c="dimmed" size="xs" visibleFrom="sm">{words} words</Text>
      {folderPath && <Text c="dimmed" size="xs" visibleFrom="sm">{folderPath}</Text>}
      <Text c="dimmed" ml="auto" size="xs">Autosave on</Text>
    </Group>
  )
})
