import { Box, Button, Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconNotes, IconPlus } from '@tabler/icons-react'

import { memo, useCallback, useEffect, useMemo } from 'react'
import { useParams } from 'react-router'

import { EditorSkeleton } from '@/components/common/Skeletons'
import { TopProgress } from '@/components/common/TopProgress'
import { Editor } from '@/components/editor/Editor'
import { TabBar } from '@/components/editor/TabBar'
import { AppShellLayout } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { NoteList } from '@/components/notes/NoteList'
import { SpotlightSearch } from '@/components/search/SpotlightSearch'
import { useCreateNote, useNote } from '@/hooks/queries/useNotes'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'

export const AppPage = memo(function AppPage() {
  const { uuid: routeUuid } = useParams<{ uuid: string }>()
  const isPhone = useIsPhone()
  const { setView, scope } = useUiStore()
  const { activeUuid, open: openTab } = useTabsStore()
  const createNote = useCreateNote()

  useEffect(() => {
    if (routeUuid) {
      openTab(routeUuid, '')
    }
  }, [routeUuid, openTab])

  const { data: note, isLoading } = useNote(activeUuid)

  const handleSelectNote = useCallback(
    (uuid: string) => {
      openTab(uuid, '')
      if (isPhone) {
        setView('editor')
      }
    },
    [isPhone, openTab, setView]
  )

  const handleCreateNote = useCallback(() => {
    createNote.mutate(
      {},
      {
        onSuccess: (newNote) => {
          openTab(newNote.uuid, newNote.title || 'Untitled')
          if (isPhone) {
            setView('editor')
          }
        },
      },
    )
  }, [createNote, isPhone, openTab, setView])

  const headerSlot = useMemo(() => <Header />, [])
  const navSlot = useMemo(() => <Sidebar />, [])
  const listSlot = useMemo(
    () => <NoteList activeUuid={activeUuid} onSelectNote={handleSelectNote} />,
    [activeUuid, handleSelectNote]
  )

  const editorSlot = useMemo(
    () => (
      <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <TabBar />
        {isLoading ? (
          <Box p="xl" style={{ flex: 1, overflowY: 'auto' }}>
            <EditorSkeleton />
          </Box>
        ) : note ? (
          <Editor key={note.uuid} note={note} />
        ) : (
          <Center p="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="sm">
              <ThemeIcon color="blue" radius="xl" size={48} variant="light">
                <IconNotes size={26} />
              </ThemeIcon>
              <Text fw={600} size="md">No note selected</Text>
              <Text c="dimmed" maw={300} size="sm" ta="center">
                {scope.kind === 'trash'
                  ? 'Choose a note from Trash to view or restore it.'
                  : 'Choose a note from the list, or create a new one to begin writing.'}
              </Text>
              {scope.kind !== 'trash' && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  loading={createNote.isPending}
                  mt="xs"
                  size="sm"
                  variant="light"
                  onClick={handleCreateNote}
                >
                  New note
                </Button>
              )}
            </Stack>
          </Center>
        )}
      </Box>
    ),
    [isLoading, note, createNote.isPending, handleCreateNote, scope.kind]
  )

  const statusSlot = useMemo(
    () => (
      <StatusBar
        folderPath={note?.folder?.name ?? null}
        words={note?.word_count ?? 0}
      />
    ),
    [note?.word_count, note?.folder?.name]
  )

  return (
    <>
      <TopProgress />
      <SpotlightSearch />

      <AppShellLayout
        editor={editorSlot}
        header={headerSlot}
        list={listSlot}
        nav={navSlot}
        status={statusSlot}
      />
    </>
  )
})
