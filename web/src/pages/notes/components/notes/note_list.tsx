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
import { IconFolder, IconPlus, IconTrashX } from '@tabler/icons-react'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import type { TNotesPage } from '@src/api/notes_api'
import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { MAX_NOTE_TITLE_LENGTH } from '@src/constants/limits'
import { useIsPhone } from '@src/hooks/use_is_phone'
import { type IScopeState, useScope } from '@src/pages/notes/hooks/use_scope'
import { type IScopeFilter, useScopeFilter } from '@src/pages/notes/hooks/use_scope_filter'
import { useBootstrap } from '@src/queries/bootstrap_queries'
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
} from '@src/queries/notes_queries'
import type { TCreateNoteMutation, TDuplicateNoteMutation, TMoveNoteMutation, TRenameNoteMutation, TStarNoteMutation } from '@src/queries/notes_queries'
import { useTabsStore } from '@src/stores/tabs_store'
import type { ITabsState } from '@src/stores/tabs_store'
import { type IUiState, type TView, useUiStore } from '@src/stores/ui_store'
import type { IBootstrap, IFolder, INote, INoteListItem, TUuid } from '@src/types/api'
import { ListSkeleton } from '@src/ui/skeletons/skeletons'
import { filterNotes } from '@src/utils/filter_notes'

import { EmptyTrashModal } from './empty_trash_modal'
import { FilterInput } from './filter_input'
import { NoteRow } from './note_row'



export interface INoteListProps {
  activeUuid?:  string | null
  onSelectNote: (uuid: string, title?: string) => void
}

export const NoteList: React.NamedExoticComponent<INoteListProps> = memo(function NoteList({
  activeUuid,
  onSelectNote,
}: INoteListProps): React.JSX.Element {
  const setView: (view: TView) => void = useUiStore((s: IUiState) => s.setView)
  const { scope, label: scopeLabel }: IScopeState = useScope()
  const { filter }: IScopeFilter = useScopeFilter(scope)
  const isPhone: boolean = useIsPhone()
  const closeTab: (uuid: TUuid) => void = useTabsStore((s: ITabsState) => s.close)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotes(scope)
  const { folders } = useBootstrap()

  const starNote: TStarNoteMutation = useStarNote(scope)
  const trashNote: UseMutationResult<void, IApiError, string, { prevNotes: [readonly unknown[], unknown][]; prevBootstrap: IBootstrap | undefined; }> = useTrashNote()
  const duplicateNote: TDuplicateNoteMutation = useDuplicateNote()
  const createNote: TCreateNoteMutation = useCreateNote()
  const restoreNote: UseMutationResult<void, IApiError, string, { prevNotes: [readonly unknown[], unknown][]; prevBootstrap: IBootstrap | undefined; }> = useRestoreNote()
  const forceDeleteNote: UseMutationResult<void, IApiError, string, { prevNotes: [readonly unknown[], unknown][]; prevBootstrap: IBootstrap | undefined; }> = useForceDeleteNote()
  const renameNote: TRenameNoteMutation = useRenameNote()
  const moveNoteFolder: TMoveNoteMutation = useMoveNoteFolder()

  const [restoreModalNote, setRestoreModalNote] = useState<INoteListItem | null>(null)
  const [moveModalNote, setMoveModalNote] = useState<INoteListItem | null>(null)
  const [renameModalNote, setRenameModalNote] = useState<INoteListItem | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState<boolean>(false)

  const allNotes: INoteListItem[] = useMemo(() => {
    return data?.pages.flatMap((page: TNotesPage) => page.data) ?? []
  }, [data])

  const filtered: INoteListItem[] = useMemo(() => {
    return filterNotes(allNotes, filter)
  }, [allNotes, filter])

  const handleOpen: (uuid: string, title?: string) => void = useCallback(
    (uuid: string, title?: string) => {
      onSelectNote(uuid, title)
      if (isPhone) setView('editor')
    },
    [onSelectNote, isPhone, setView],
  )

  const handleRestoreToFolder: (folderId: TUuid | null) => Promise<void> = useCallback(
    async (folderId: TUuid | null) => {
      if (!restoreModalNote) return
      const uuid: string = restoreModalNote.uuid
      setRestoreModalNote(null)
      await restoreNote.mutateAsync(uuid)
      if (folderId !== null) {
        await moveNoteFolder.mutateAsync({ uuid, folderId: folderId })
      }
    },
    [restoreModalNote, restoreNote, moveNoteFolder],
  )

  const handleMoveToFolder: (folderId: TUuid | null) => void = useCallback(
    (folderId: TUuid | null) => {
      if (!moveModalNote) return
      const uuid: string = moveModalNote.uuid
      setMoveModalNote(null)
      moveNoteFolder.mutate({ uuid, folderId: folderId })
    },
    [moveModalNote, moveNoteFolder],
  )

  const handleCreateNote: () => void = useCallback(() => {
    const uuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
    createNote.mutate(
      { ...(scope.kind === 'folder' ? { folderId: scope.uuid } : {}), uuid },
      {
        onSuccess: (newNote: INote) => {
          onSelectNote(newNote.uuid, newNote.title || DEFAULT_NOTE_TITLE)
          if (isPhone) {
            setView('editor')
          }
        },
      },
    )
    onSelectNote(uuid, DEFAULT_NOTE_TITLE)
    if (isPhone) {
      setView('editor')
    }
  }, [createNote, scope, onSelectNote, isPhone, setView])

  const handleCloseRestoreModal: () => void = useCallback(() => {
    setRestoreModalNote(null)
  }, [])

  const handleOpenEmptyTrash: () => void = useCallback((): void => setIsEmptyTrashOpen(true), [])
  const handleCloseEmptyTrash: () => void = useCallback((): void => setIsEmptyTrashOpen(false), [])

  const handleOpenRename: (note: INoteListItem) => void = useCallback((note: INoteListItem) => {
    setRenameModalNote(note)
    setRenameTitle(note.title || '')
  }, [])

  const handleCloseRename: () => void = useCallback(() => {
    setRenameModalNote(null)
    setRenameTitle('')
  }, [])

  const handleConfirmRename: (e?: React.FormEvent) => void = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (!renameModalNote) return
      const title: string = renameTitle.trim()
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

  const sentinelRef: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null)

  const handleBottomReached: () => void = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const el: HTMLDivElement | null = sentinelRef.current
    if (!el || !hasNextPage) return

    const observer: IntersectionObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        const first: IntersectionObserverEntry | undefined = entries[0]
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: '150px' },
    )

    observer.observe(el)
    return (): void => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const totalCount: number = data?.pages[0]?.meta.totalCount ?? allNotes.length

  return (
    <Stack gap="xs" h="100%" p="sm">
      <Group align="center" justify="space-between" wrap="nowrap">
        <Group align="baseline" gap="xs" style={{ minWidth: 0, flex: 1 }} wrap="nowrap">
          <Text truncate fw={700} size="sm">
            {scopeLabel}
          </Text>
          <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
            {totalCount} {totalCount === 1 ? 'note' : 'notes'}
          </Text>
        </Group>
        {scope.kind !== 'trash' && (
          <Button
            aria-label="Create note"
            leftSection={<IconPlus size={14} />}
            loading={createNote.isPending}
            size="xs"
            variant="light"
            onClick={handleCreateNote}
          >
            Create note
          </Button>
        )}
        {scope.kind === 'trash' && totalCount > 0 && (
          <Button
            color="red"
            leftSection={<IconTrashX size={14} />}
            size="xs"
            variant="light"
            onClick={handleOpenEmptyTrash}
          >
            Empty Trash
          </Button>
        )}
      </Group>

      <FilterInput
        hasMore={Boolean(hasNextPage)}
        localCount={filtered.length}
        params={{}}
        scope={scope}
        scopeLabel={scopeLabel}
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
            {filtered.map((note: INoteListItem) => (
              <NoteRow
                key={note.uuid}
                active={note.uuid === activeUuid}
                note={note}
                onDuplicate={() => duplicateNote.mutate(note.uuid)}
                onForceDelete={() => {
                  closeTab(note.uuid)
                  forceDeleteNote.mutate(note.uuid)
                }}
                onMoveToFolder={() => setMoveModalNote(note)}
                onOpen={() => handleOpen(note.uuid, note.title)}
                onRename={() => handleOpenRename(note)}
                onRestore={() => restoreNote.mutate(note.uuid)}
                onRestoreTo={() => setRestoreModalNote(note)}
                onStar={() => starNote.mutate({ uuid: note.uuid, isStarred: !note.isStarred })}
                onTrash={() => {
                  closeTab(note.uuid)
                  trashNote.mutate(note.uuid)
                }}
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
          {folders.map((folder: IFolder) => (
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
          {folders.map((folder: IFolder) => (
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
              maxLength={MAX_NOTE_TITLE_LENGTH}
              placeholder="Enter note title"
              value={renameTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => setRenameTitle(e.currentTarget.value)}
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

      {isEmptyTrashOpen && <EmptyTrashModal noteCount={totalCount} onClose={handleCloseEmptyTrash} />}
    </Stack>
  )
})
