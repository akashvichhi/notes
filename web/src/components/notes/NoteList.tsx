import { ActionIcon, Box, Button, Center, Group, Menu, ScrollArea, Stack, Text } from '@mantine/core'
import { IconArrowsSort, IconPlus } from '@tabler/icons-react'
import { useMemo } from 'react'

import { ListSkeleton } from '@/components/common/Skeletons'
import { FilterInput } from './FilterInput'
import { NoteRow } from './NoteRow'
import { useCreateNote, useDuplicateNote, useNotes, useStarNote, useTrashNote } from '@/hooks/queries/useNotes'
import { filterNotes } from '@/lib/filterNotes'
import { useUiStore } from '@/stores/uiStore'
import { useIsPhone } from '../layout/AppShell'

export function NoteList({
  activeUuid,
  onSelectNote,
}: {
  activeUuid?: string | null
  onSelectNote: (uuid: string) => void
}) {
  const { scope, filter, setView } = useUiStore()
  const isPhone = useIsPhone()

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotes(scope)
  const starNote = useStarNote(scope)
  const trashNote = useTrashNote()
  const duplicateNote = useDuplicateNote()
  const createNote = useCreateNote()

  const allNotes = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const filtered = useMemo(() => {
    return filterNotes(allNotes, filter)
  }, [allNotes, filter])

  const handleOpen = (uuid: string) => {
    onSelectNote(uuid)
    if (isPhone) setView('editor')
  }

  return (
    <Stack gap="xs" p="sm" h="100%">
      <Group justify="space-between">
        <Text fw={700} size="sm">{scope.label}</Text>
        <Group gap="xs">
          <Text size="xs" c="dimmed">{allNotes.length} notes</Text>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon size="sm" variant="subtle" aria-label="Sort options">
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
        totalCount={allNotes.length}
        params={{}}
      />

      <ScrollArea style={{ flex: 1 }}>
        {isLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <Center h={180}>
            <Stack align="center" gap="xs">
              <Text size="sm" c="dimmed">No notes found</Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => createNote.mutate({})}
              >
                Create note
              </Button>
            </Stack>
          </Center>
        ) : (
          <Stack gap={4}>
            {filtered.map((note) => (
              <NoteRow
                key={note.uuid}
                note={note}
                active={note.uuid === activeUuid}
                onOpen={() => handleOpen(note.uuid)}
                onStar={() => starNote.mutate({ uuid: note.uuid, is_starred: !note.is_starred })}
                onTrash={() => trashNote.mutate(note.uuid)}
                onDuplicate={() => duplicateNote.mutate(note.uuid)}
              />
            ))}
            {hasNextPage && (
              <Button
                variant="subtle"
                size="xs"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                Load more
              </Button>
            )}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  )
}
