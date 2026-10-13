import { Group, Text } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import type { SaveStatus } from '@/hooks/useAutosave'

dayjs.extend(relativeTime)

export function StatusBar({
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
  return (
    <Group h={28} px="sm" gap="lg" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      {/* No spinner: autosave fires every ~800ms and a spinner that often is noise. */}
      {status === 'saving' && <Text size="xs" c="dimmed">Saving…</Text>}
      {status === 'saved' && savedAt && (
        <Text size="xs" c="dimmed">Saved · {dayjs(savedAt).fromNow()}</Text>
      )}
      {status === 'error' && (
        <Text size="xs" c="orange" style={{ cursor: 'pointer' }} onClick={onRetry}>
          Couldn&apos;t save · retrying — Retry now
        </Text>
      )}

      <Text size="xs" c="dimmed" visibleFrom="sm">{words} words</Text>
      {folderPath && <Text size="xs" c="dimmed" visibleFrom="sm">{folderPath}</Text>}
      <Text size="xs" c="dimmed" ml="auto">Autosave on</Text>
    </Group>
  )
}
