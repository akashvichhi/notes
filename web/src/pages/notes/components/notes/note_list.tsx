import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { NavigateFunction } from 'react-router'

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
import { IconCloud, IconFolder, IconPlus } from '@tabler/icons-react'
import type { UseMutationResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import type { NotesPage } from '@src/api/notes_api'
import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { MAX_NOTE_TITLE_LENGTH } from '@src/constants/limits'
import { useIsPhone } from '@src/hooks/use_is_phone'
import { isNative } from '@src/platform/is_native'
import { useMe } from '@src/queries/auth_queries'
import { useBootstrap, useLocalSidebar } from '@src/queries/bootstrap_queries'
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
import { ROUTE_PATHS } from '@src/routes/route_paths'
import { useTabsStore } from '@src/stores/tabs_store'
import type { TabsState } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import type { Bootstrap, Folder, Note, NoteListItem, UUID } from '@src/types/api'
import { ListSkeleton } from '@src/ui/skeletons/skeletons'
import { filterNotes } from '@src/utils/filter_notes'

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
  const navigate: NavigateFunction = useNavigate()
  const { data: user } = useMe()
  const { scope, filter, setView } = useUiStore()
  const isCloudSignedOut: boolean = scope.container === 'cloud' && !user
  const isPhone: boolean = useIsPhone()
  const closeTab: (uuid: UUID) => void = useTabsStore((s: TabsState) => s.close)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotes(scope)
  const { folders: cloudFolders } = useBootstrap()
  const { data: localData } = useLocalSidebar()
  const localFolders: Folder[] = localData?.folders ?? []

  const starNote: TStarNoteMutation = useStarNote(scope)
  const trashNote: UseMutationResult<void, ApiError, string, { prevNotes: [readonly unknown[], unknown][]; prevBootstrap: Bootstrap | undefined; prevLocal: unknown; }> = useTrashNote()
  const duplicateNote: TDuplicateNoteMutation = useDuplicateNote()
  const createNote: TCreateNoteMutation = useCreateNote()
  const restoreNote: UseMutationResult<void, ApiError, string, { prevNotes: [readonly unknown[], unknown][]; prevBootstrap: Bootstrap | undefined; prevLocal: unknown; }> = useRestoreNote()
  const forceDeleteNote: UseMutationResult<void, ApiError, string, { prevNotes: [readonly unknown[], unknown][]; prevBootstrap: Bootstrap | undefined; prevLocal: unknown; }> = useForceDeleteNote()
  const renameNote: TRenameNoteMutation = useRenameNote()
  const moveNoteFolder: TMoveNoteMutation = useMoveNoteFolder()

  const [restoreModalNote, setRestoreModalNote] = useState<NoteListItem | null>(null)
  const [moveModalNote, setMoveModalNote] = useState<NoteListItem | null>(null)
  const [renameModalNote, setRenameModalNote] = useState<NoteListItem | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const moveModalContainer: 'cloud' | 'local' = moveModalNote?.container ?? scope.container ?? (isNative() ? 'local' : 'cloud')
  const moveModalFolders: Folder[] = moveModalContainer === 'local' ? localFolders : cloudFolders

  const restoreModalContainer: 'cloud' | 'local' = restoreModalNote?.container ?? scope.container ?? (isNative() ? 'local' : 'cloud')
  const restoreModalFolders: Folder[] = restoreModalContainer === 'local' ? localFolders : cloudFolders

  const allNotes: NoteListItem[] = useMemo(() => {
    return data?.pages.flatMap((page: NotesPage) => page.data) ?? []
  }, [data])

  const filtered: NoteListItem[] = useMemo(() => {
    return filterNotes(allNotes, filter)
  }, [allNotes, filter])

  const handleOpen: (uuid: string, title?: string) => void = useCallback(
    (uuid: string, title?: string) => {
      onSelectNote(uuid, title)
      if (isPhone) setView('editor')
    },
    [onSelectNote, isPhone, setView],
  )

  const handleRestoreToFolder: (folderId: UUID | null) => Promise<void> = useCallback(
    async (folderId: UUID | null) => {
      if (!restoreModalNote) return
      const uuid: string = restoreModalNote.uuid
      setRestoreModalNote(null)
      await restoreNote.mutateAsync(uuid)
      if (folderId !== null) {
        await moveNoteFolder.mutateAsync({ uuid, folder_id: folderId })
      }
    },
    [restoreModalNote, restoreNote, moveNoteFolder],
  )

  const handleMoveToFolder: (folderId: UUID | null) => void = useCallback(
    (folderId: UUID | null) => {
      if (!moveModalNote) return
      const uuid: string = moveModalNote.uuid
      setMoveModalNote(null)
      moveNoteFolder.mutate({ uuid, folder_id: folderId })
    },
    [moveModalNote, moveNoteFolder],
  )

  const handleCreateNote: () => void = useCallback(() => {
    const uuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
    createNote.mutate(
      { ...(scope.kind === 'folder' ? { folder_id: scope.uuid } : {}), uuid },
      {
        onSuccess: (newNote: Note) => {
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

  const handleOpenRename: (note: NoteListItem) => void = useCallback((note: NoteListItem) => {
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

  const totalCount: number = data?.pages[0]?.meta.total ?? allNotes.length

  return (
    <Stack gap="xs" h="100%" p="sm">
      <Group align="center" justify="space-between" wrap="nowrap">
        <Group align="baseline" gap="xs" style={{ minWidth: 0, flex: 1 }} wrap="nowrap">
          <Text truncate fw={700} size="sm">
            {scope.label}
          </Text>
          <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
            {totalCount} {totalCount === 1 ? 'note' : 'notes'}
          </Text>
        </Group>
        {scope.kind !== 'trash' && !isCloudSignedOut && (
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
      </Group>

      <FilterInput
        hasMore={Boolean(hasNextPage)}
        localCount={filtered.length}
        params={{}}
        totalCount={totalCount}
      />

      <ScrollArea style={{ flex: 1 }} onBottomReached={handleBottomReached}>
        {isCloudSignedOut ? (
          <Center h={240}>
            <Stack align="center" gap="xs" maw={280} ta="center">
              <IconCloud opacity={0.4} size={36} />
              <Text fw={600} size="sm">
                Cloud sync is inactive
              </Text>
              <Text c="dimmed" size="xs">
                Sign in to access, create, and sync Cloud notes across devices.
              </Text>
              <Button size="xs" variant="light" onClick={() => navigate(ROUTE_PATHS.LOGIN)}>
                Sign in to Cloud
              </Button>
            </Stack>
          </Center>
        ) : isLoading ? (
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
            {filtered.map((note: NoteListItem) => (
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
                onStar={() => starNote.mutate({ uuid: note.uuid, is_starred: !note.is_starred })}
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
          {moveModalFolders.map((folder: Folder) => (
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
          {restoreModalFolders.map((folder: Folder) => (
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
    </Stack>
  )
})
