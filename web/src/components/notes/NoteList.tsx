import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconFolder, IconPlus } from '@tabler/icons-react'


import { patchNote } from '@/api/notes'
import { ListSkeleton } from '@/components/common/Skeletons'
import { useBootstrap } from '@/hooks/queries/useBootstrap'
import {
  useCreateNote,
  useDuplicateNote,
  useForceDeleteNote,
  useMoveNoteFolder,
  useNotes,
  useRenameNote,
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
  onSelectNote: (uuid: string, title?: string) => void
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
  const renameNote = useRenameNote()
  const moveNoteFolder = useMoveNoteFolder()

  const [restoreModalNote, setRestoreModalNote] = useState<NoteListItem | null>(null)
  const [moveModalNote, setMoveModalNote] = useState<NoteListItem | null>(null)
  const [renameModalNote, setRenameModalNote] = useState<NoteListItem | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const allNotes = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const filtered = useMemo(() => {
    return filterNotes(allNotes, filter)
  }, [allNotes, filter])

  const handleOpen = useCallback(
    (uuid: string, title?: string) => {
      onSelectNote(uuid, title)
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

  const handleMoveToFolder = useCallback(
    (folderId: UUID | null) => {
      if (!moveModalNote) return
      const uuid = moveModalNote.uuid
      setMoveModalNote(null)
      moveNoteFolder.mutate({ uuid, folder_id: folderId })
    },
    [moveModalNote, moveNoteFolder],
  )

  const handleCreateNote = useCallback(() => {
    createNote.mutate(scope.kind === 'folder' ? { folder_id: scope.uuid } : {})
  }, [createNote, scope])

  const handleCloseRestoreModal = useCallback(() => {
    setRestoreModalNote(null)
  }, [])

  const handleOpenRename = useCallback((note: NoteListItem) => {
    setRenameModalNote(note)
    setRenameTitle(note.title || '')
  }, [])

  const handleCloseRename = useCallback(() => {
    setRenameModalNote(null)
    setRenameTitle('')
  }, [])

  const handleConfirmRename = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (!renameModalNote) return
      const title = renameTitle.trim()
      if (title !== renameModalNote.title) {
        renameNote.mutate({
          uuid: renameModalNote.uuid,
          title,
        })
      }
      handleCloseRename()
    },
    [renameModalNote, renameNote, renameTitle, handleCloseRename],
  )

  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleBottomReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: '150px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const totalCount = data?.pages[0]?.meta.total ?? allNotes.length

  return (
    <Stack gap="xs" h="100%" p="sm">
      <Group justify="space-between">
        <Text fw={700} size="sm">{scope.label}</Text>
        <Group gap="xs">
          <Text c="dimmed" size="xs">{totalCount} notes</Text>
        </Group>
      </Group>

      <FilterInput
        hasMore={Boolean(hasNextPage)}
        localCount={filtered.length}
        params={{}}
        totalCount={totalCount}
      />

      <ScrollArea style={{ flex: 1 }} onBottomReached={handleBottomReached}>
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
                  loading={createNote.isPending}
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
                onMoveToFolder={() => setMoveModalNote(note)}
                onOpen={() => handleOpen(note.uuid, note.title)}
                onRename={() => handleOpenRename(note)}
                onRestore={() => restoreNote.mutate(note.uuid)}
                onRestoreTo={() => setRestoreModalNote(note)}
                onStar={() => starNote.mutate({ uuid: note.uuid, is_starred: !note.is_starred })}
                onTrash={() => trashNote.mutate(note.uuid)}
              />
            ))}
            {hasNextPage && (
              <Box ref={sentinelRef} py="xs">
                {isFetchingNextPage && (
                  <Center>
                    <Loader size="xs" />
                  </Center>
                )}
              </Box>
            )}
          </Stack>
        )}
      </ScrollArea>

      <Modal
        centered
        opened={Boolean(moveModalNote)}
        size="sm"
        title="Move note to folder"
        onClose={() => setMoveModalNote(null)}
      >
        <Stack gap="xs">
          <NavLink
            active={!moveModalNote?.folder}
            label="Root (No folder)"
            leftSection={<IconFolder size={16} />}
            onClick={() => handleMoveToFolder(null)}
          />
          {folders.map((folder) => (
            <NavLink
              key={folder.uuid}
              active={moveModalNote?.folder?.uuid === folder.uuid}
              label={folder.name}
              leftSection={<IconFolder size={16} />}
              onClick={() => handleMoveToFolder(folder.uuid)}
            />
          ))}
        </Stack>
      </Modal>

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

      <Modal
        centered
        opened={Boolean(renameModalNote)}
        size="sm"
        title="Rename note"
        onClose={handleCloseRename}
      >
        <form onSubmit={handleConfirmRename}>
          <Stack gap="sm">
            <TextInput
              autoFocus
              data-autofocus
              label="Note title"
              placeholder="Enter note title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.currentTarget.value)}
            />
            <Group gap="xs" justify="flex-end">
              <Button variant="default" onClick={handleCloseRename}>
                Cancel
              </Button>
              <Button type="submit">
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
})
