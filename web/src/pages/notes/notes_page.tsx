import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { Box, Button, Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconNotes, IconPlus } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'

import { EditorSkeleton } from '@src/ui/skeletons/skeletons'
import { TopProgress } from '@src/pages/notes/components/top_progress'
import { Editor } from '@src/pages/notes/components/editor/editor'
import { TabBar } from '@src/pages/notes/components/editor/tab_bar'
import { AppShellLayout } from '@src/pages/notes/components/layout/app_shell'
import { Header } from '@src/pages/notes/components/layout/header'
import { Sidebar } from '@src/pages/notes/components/layout/sidebar'
import { StatusBar } from '@src/pages/notes/components/layout/status_bar'
import { NoteList } from '@src/pages/notes/components/notes/note_list'
import { SpotlightSearch } from '@src/pages/notes/components/search/spotlight_search'
import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { queryKeys } from '@src/constants/query_keys'
import { useCreateNote, useNote } from '@src/queries/notes_queries'
import { useIsPhone } from '@src/hooks/use_is_phone'
import { notePath, ROUTE_PATHS } from '@src/routes/route_paths'
import { useTabsStore } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'

export const AppPage = memo(function AppPage() {
  const qc = useQueryClient()
  const { uuid: routeUuid } = useParams<{ uuid: string }>()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const { setView, scope } = useUiStore()
  const { activeUuid, open: openTab } = useTabsStore()
  const createNote = useCreateNote()

  // The URL and the active tab follow each other. A route that changed (a link,
  // a refresh, back/forward) opens its note; otherwise the URL follows the
  // active tab, however it was chosen: list, tabs, search, closing a tab. Each
  // note opened is a history entry, so Back and Forward step through them.
  // Landing on `/` is replaced instead: otherwise Back would return to `/`,
  // which would forward straight to the saved tab again.
  const lastRouteUuid = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (routeUuid !== lastRouteUuid.current) {
      lastRouteUuid.current = routeUuid
      if (routeUuid && routeUuid !== activeUuid) {
        openTab(routeUuid, '')
        return
      }
    }

    const target = activeUuid ? notePath(activeUuid) : ROUTE_PATHS.HOME
    if (pathname !== target) {
      void navigate(target, { replace: pathname === ROUTE_PATHS.HOME })
    }
  }, [routeUuid, activeUuid, pathname, navigate, openTab])

  const { data: note, isLoading } = useNote(activeUuid)

  // Sync tab title whenever note data is available
  useEffect(() => {
    if (note?.uuid && note.title) {
      useTabsStore.getState().setTitle(note.uuid, note.title)
    }
  }, [note?.uuid, note?.title])

  const handleSelectNote = useCallback(
    (uuid: string, title?: string) => {
      openTab(uuid, title || DEFAULT_NOTE_TITLE)
      void qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      if (isPhone) {
        setView('editor')
      }
    },
    [isPhone, openTab, qc, setView],
  )

  const handleCreateNote = useCallback(() => {
    createNote.mutate(
      {},
      {
        onSuccess: (newNote) => {
          openTab(newNote.uuid, newNote.title || DEFAULT_NOTE_TITLE)
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
                  {DEFAULT_NOTE_TITLE}
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
        container={note?.container ?? scope.container}
        folderPath={note?.folder?.name ?? null}
        words={note?.word_count ?? 0}
      />
    ),
    [note?.word_count, note?.folder?.name, note?.container, scope.container]
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
