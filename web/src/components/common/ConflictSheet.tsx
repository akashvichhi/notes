import { Button, Group, Modal, Stack, Text } from '@mantine/core'

import { memo } from 'react'

import type { Note } from '@/types/api'

export const ConflictSheet = memo(function ConflictSheet({
  serverCopy, onKeepMine, onKeepTheirs, onSaveCopy, onClose,
}: {
  serverCopy: Note
  onKeepMine: () => void; onKeepTheirs: () => void; onSaveCopy: () => void; onClose: () => void
}) {
  return (
    <Modal centered opened title="This note changed somewhere else" onClose={onClose}>
      <Stack>
        <Text size="sm">
          Another tab or device saved version {serverCopy.version} while you were typing.
          Nothing has been lost — choose what to keep.
        </Text>
        <Group>
          <Button onClick={onKeepMine}>Keep mine</Button>
          <Button variant="default" onClick={onKeepTheirs}>Keep theirs</Button>
          <Button variant="default" onClick={onSaveCopy}>Save mine as a copy</Button>
        </Group>
      </Stack>
    </Modal>
  )
})
