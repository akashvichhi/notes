import { Box, Button, Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconNotes, IconPlus } from '@tabler/icons-react'

import { EditorSkeleton } from '@/components/common/Skeletons'
import { TopProgress } from '@/components/common/TopProgress'
import { Editor } from '@/components/editor/Editor'
import { TabBar } from '@/components/editor/TabBar'
import { AppShellLayout } from '@/components/layout/AppShell'
import { useIsPhone } from '@/hooks/useIsPhone'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { NoteList } from '@/components/notes/NoteList'
import { SpotlightSearch } from '@/components/search/SpotlightSearch'
import { useCreateNote, useNote } from '@/hooks/queries/useNotes'
import { useEffect } from 'react'
import { useParams } from 'react-router'

import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'

export function AppPage() {
  const { uuid: routeUuid } = useParams<{ uuid: string }>()
  const isPhone = useIsPhone()
  const { setView } = useUiStore()
  const { activeUuid, open: openTab } = useTabsStore()
  const createNote = useCreateNote()

  useEffect(() => {
    if (routeUuid) {
      openTab(routeUuid, '')
    }
  }, [routeUuid, openTab])

  const { data: note, isLoading } = useNote(activeUuid)

  const handleSelectNote = (uuid: string) => {
    openTab(uuid, '')
    if (isPhone) {
      setView('editor')
    }
  }

  const handleCreateNote = () => {
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
  }

  return (
    <>
      <TopProgress />
      <SpotlightSearch />

      <AppShellLayout
        header={<Header />}
        nav={<Sidebar />}
        list={<NoteList activeUuid={activeUuid} onSelectNote={handleSelectNote} />}
        editor={
          <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <TabBar />
            {isLoading ? (
              <Box p="xl" style={{ flex: 1, overflowY: 'auto' }}>
                <EditorSkeleton />
              </Box>
            ) : note ? (
              <Editor key={note.uuid} note={note} />
            ) : (
              <Center style={{ flex: 1 }} p="xl">
                <Stack align="center" gap="sm">
                  <ThemeIcon size={48} radius="xl" variant="light" color="blue">
                    <IconNotes size={26} />
                  </ThemeIcon>
                  <Text fw={600} size="md">No note selected</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={300}>
                    Choose a note from the list, or create a new one to begin writing.
                  </Text>
                  <Button
                    size="sm"
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    loading={createNote.isPending}
                    onClick={handleCreateNote}
                    mt="xs"
                  >
                    New note
                  </Button>
                </Stack>
              </Center>
            )}
          </Box>
        }
        status={
          <StatusBar
            words={note?.word_count ?? 0}
            folderPath={note?.folder?.name ?? null}
          />
        }
      />
    </>
  )
}
