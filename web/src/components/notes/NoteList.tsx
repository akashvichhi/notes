import {
  ActionIcon,
  Button,
  Center,
  Group,
  Menu,
  Modal,
  NavLink,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { IconArrowsSort, IconFolder, IconPlus } from '@tabler/icons-react'

import { memo, useCallback, useMemo, useState } from 'react'

import { patchNote } from '@/api/notes'
import { ListSkeleton } from '@/components/common/Skeletons'
import { useBootstrap } from '@/hooks/queries/useBootstrap'
import {
  useCreateNote,
  useDuplicateNote,
  useForceDeleteNote,
  useNotes,
  useRestoreNote,
  useStarNote,
  useTrashNote,
} from '@/hooks/queries/useNotes'
import { useIsPhone } from '@/hooks/useIsPhone'
import { filterNotes } from '@/lib/filterNotes'
import { useUiStore } from '@/stores/uiStore'
import type { NoteListItem, UUID } from '@/types/api'

import { FilterInput } from './FilterInput'
import { NoteRow } from './NoteRow'

export const NoteList = memo(function NoteList({
  activeUuid,
  onSelectNote,
}: {
  activeUuid?: string | null
  onSelectNote: (uuid: string) => void
}) {
  const { scope, filter, setView } = useUiStore()
  const isPhone = useIsPhone()

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotes(scope)
  const { folders } = useBootstrap()

  const starNote = useStarNote(scope)
  const trashNote = useTrashNote()
  const duplicateNote = useDuplicateNote()
  const createNote = useCreateNote()
  const restoreNote = useRestoreNote()
  const forceDeleteNote = useForceDeleteNote()

  const [restoreModalNote, setRestoreModalNote] = useState<NoteListItem | null>(null)

  const allNotes = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const filtered = useMemo(() => {
    return filterNotes(allNotes, filter)
  }, [allNotes, filter])

  const handleOpen = useCallback(
    (uuid: string) => {
      onSelectNote(uuid)
      if (isPhone) setView('editor')
    },
    [onSelectNote, isPhone, setView],
  )

  const handleRestoreToFolder = useCallback(
    async (folderId: UUID | null) => {
      if (!restoreModalNote) return
      const uuid = restoreModalNote.uuid
      setRestoreModalNote(null)
      await restoreNote.mutateAsync(uuid)
      if (folderId !== null) {
        await patchNote(uuid, { folder_id: folderId })
      }
    },
    [restoreModalNote, restoreNote],
  )

  const handleCreateNote = useCallback(() => {
    createNote.mutate({})
  }, [createNote])

  const handleCloseRestoreModal = useCallback(() => {
    setRestoreModalNote(null)
  }, [])

  return (
    <Stack gap="xs" h="100%" p="sm">
      <Group justify="space-between">
        <Text fw={700} size="sm">{scope.label}</Text>
        <Group gap="xs">
          <Text c="dimmed" size="xs">{allNotes.length} notes</Text>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon aria-label="Sort options" size="sm" variant="subtle">
                <IconArrowsSort size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Sort by</Menu.Label>
              <Menu.Item>Date updated</Menu.Item>
              <Menu.Item>Date created</Menu.Item>
              <Menu.Item>Title A–Z</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <FilterInput
        hasMore={Boolean(hasNextPage)}
        localCount={filtered.length}
        params={{}}
        totalCount={allNotes.length}
      />

      <ScrollArea style={{ flex: 1 }}>
        {isLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <Center h={180}>
            <Stack align="center" gap="xs">
              <Text c="dimmed" size="sm">
                {scope.kind === 'trash' ? 'Trash is empty' : 'No notes found'}
              </Text>
              {scope.kind !== 'trash' && (
                <Button
                  leftSection={<IconPlus size={14} />}
                  size="xs"
                  variant="light"
                  onClick={handleCreateNote}
                >
                  Create note
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <Stack gap={4}>
            {filtered.map((note) => (
              <NoteRow
                key={note.uuid}
                active={note.uuid === activeUuid}
                note={note}
                onDuplicate={() => duplicateNote.mutate(note.uuid)}
                onForceDelete={() => forceDeleteNote.mutate(note.uuid)}
                onOpen={() => handleOpen(note.uuid)}
                onRestore={() => restoreNote.mutate(note.uuid)}
                onRestoreTo={() => setRestoreModalNote(note)}
                onStar={() => starNote.mutate({ uuid: note.uuid, is_starred: !note.is_starred })}
                onTrash={() => trashNote.mutate(note.uuid)}
              />
            ))}
            {hasNextPage && (
              <Button
                loading={isFetchingNextPage}
                size="xs"
                variant="subtle"
                onClick={() => fetchNextPage()}
              >
                Load more
              </Button>
            )}
          </Stack>
        )}
      </ScrollArea>

      <Modal
        centered
        opened={Boolean(restoreModalNote)}
        size="sm"
        title="Restore note to folder"
        onClose={handleCloseRestoreModal}
      >
        <Stack gap="xs">
          <NavLink
            label="Root (No folder)"
            leftSection={<IconFolder size={16} />}
            onClick={() => handleRestoreToFolder(null)}
          />
          {folders.map((folder) => (
            <NavLink
              key={folder.uuid}
              label={folder.name}
              leftSection={<IconFolder size={16} />}
              onClick={() => handleRestoreToFolder(folder.uuid)}
            />
          ))}
        </Stack>
      </Modal>
    </Stack>
  )
})
