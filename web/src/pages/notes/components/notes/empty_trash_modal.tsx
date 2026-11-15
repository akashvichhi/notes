import { memo, useCallback } from 'react'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { useEmptyTrash } from '@src/queries/notes_queries'

export interface IEmptyTrashModalProps {
  noteCount: number
  onClose:   () => void
}

/** Asks before permanently deleting every note in the Trash. */
export const EmptyTrashModal: React.MemoExoticComponent<(props: IEmptyTrashModalProps) => React.JSX.Element> = memo(function EmptyTrashModal({
  noteCount,
  onClose,
}: IEmptyTrashModalProps): React.JSX.Element {
  const emptyTrash: UseMutationResult<void, IApiError, void, unknown> = useEmptyTrash()

  const handleConfirm: () => void = useCallback((): void => {
    emptyTrash.mutate(undefined, { onSuccess: onClose })
  }, [emptyTrash, onClose])

  return (
    <Modal centered opened size="sm" title="Empty Trash?" onClose={onClose}>
      <Stack gap="md">
        <Text size="sm">
          {noteCount === 1 ? 'The 1 note' : `All ${noteCount} notes`} in the Trash will be deleted permanently.
          This can&apos;t be undone.
        </Text>
        <Group gap="xs" justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" loading={emptyTrash.isPending} onClick={handleConfirm}>
            Empty Trash
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
})
