import { memo } from 'react'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'

import type { INote } from '@src/types/api'

export interface IConflictSheetProps {
  serverCopy:    INote
  onKeepMine:    () => void
  onKeepTheirs:  () => void
  onSaveCopy:    () => void
  onRestoreMine: () => void
  onDiscard:     () => void
  onClose:       () => void
}

export const ConflictSheet: React.NamedExoticComponent<IConflictSheetProps> = memo(function ConflictSheet({
  serverCopy, onKeepMine, onKeepTheirs, onSaveCopy, onRestoreMine, onDiscard, onClose,
}: IConflictSheetProps): React.JSX.Element {
  // SPEC 5.5: the server refuses edits to a trashed note, so "keep mine" can't work there.
  if (serverCopy.deletedAt !== null) {
    return (
      <Modal centered opened title="This note was moved to Trash" onClose={onClose}>
        <Stack>
          <Text size="sm">
            It was moved to Trash on another device while you were typing.
            Restore it to keep your changes, or discard them.
          </Text>
          <Group>
            <Button onClick={onRestoreMine}>Restore and keep mine</Button>
            <Button variant="default" onClick={onDiscard}>Discard my changes</Button>
          </Group>
        </Stack>
      </Modal>
    )
  }

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
