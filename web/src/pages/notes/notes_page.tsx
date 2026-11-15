import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { NavigateFunction } from 'react-router'

import { Box, Button, Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconNotes, IconPlus } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { queryKeys } from '@src/constants/query_keys'
import { useIsPhone } from '@src/hooks/use_is_phone'
import { Editor } from '@src/pages/notes/components/editor/editor'
import { EditorBoundary } from '@src/pages/notes/components/editor/editor_boundary'
import { TabBar } from '@src/pages/notes/components/editor/tab_bar'
import { AppShellLayout } from '@src/pages/notes/components/layout/app_shell'
import { Header } from '@src/pages/notes/components/layout/header'
import { Sidebar } from '@src/pages/notes/components/layout/sidebar'
import { StatusBar } from '@src/pages/notes/components/layout/status_bar'
import { NoteList } from '@src/pages/notes/components/notes/note_list'
import { SpotlightSearch } from '@src/pages/notes/components/search/spotlight_search'
import { TopProgress } from '@src/pages/notes/components/top_progress'
import { useMissingScopeRedirect } from '@src/pages/notes/hooks/use_missing_scope_redirect'
import { type IScopeState, useScope } from '@src/pages/notes/hooks/use_scope'
import { useCreateNote, useNote } from '@src/queries/notes_queries'
import type { TCreateNoteMutation } from '@src/queries/notes_queries'
import { notePath, scopePath } from '@src/routes/scope_location'
import { useTabsStore } from '@src/stores/tabs_store'
import { type IUiState, type TView, useUiStore } from '@src/stores/ui_store'
import type { INote } from '@src/types/api'
import { EditorSkeleton } from '@src/ui/skeletons/skeletons'


export const AppPage: React.MemoExoticComponent<() => React.JSX.Element> = memo(function AppPage() {
  const qc: QueryClient = useQueryClient()
  const { uuid: routeUuid } = useParams<{ uuid: string }>()
  const { pathname, search } = useLocation()
  const navigate: NavigateFunction = useNavigate()
  const isPhone: boolean = useIsPhone()
  const setView: (view: TView) => void = useUiStore((s: IUiState) => s.setView)
  const { scope, isMissing }: IScopeState = useScope()
  const { activeUuid, open: openTab } = useTabsStore()
  const createNote: TCreateNoteMutation = useCreateNote()

  useMissingScopeRedirect(isMissing)

  // The URL and the active tab follow each other. A route that changed (a link,
  // a refresh, back/forward) opens its note; otherwise the URL follows the
  // active tab, however it was chosen: list, tabs, search, closing a tab. The
  // note opens under the list the URL shows (decision 13). Each note opened is
  // a history entry, so Back and Forward step through them. Landing on a list
  // without a note is replaced instead: otherwise Back would return to it,
  // which would forward straight to the open tab again.
  const lastRouteUuid: React.RefObject<string | undefined> = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (routeUuid !== lastRouteUuid.current) {
      lastRouteUuid.current = routeUuid
      if (routeUuid && routeUuid !== activeUuid) {
        openTab(routeUuid, '')
        return
      }
    }

    const target: string = activeUuid ? notePath(activeUuid, scope) : scopePath(scope)
    if (`${pathname}${search}` !== target) {
      void navigate(target, { replace: !routeUuid })
    }
  }, [routeUuid, activeUuid, pathname, search, scope, navigate, openTab])

  const { data: note, isLoading } = useNote(activeUuid)

  // Sync tab title whenever note data is available
  useEffect(() => {
    if (note?.uuid && note.title) {
      useTabsStore.getState().setTitle(note.uuid, note.title)
    }
  }, [note?.uuid, note?.title])

  const handleSelectNote: (uuid: string, title?: string) => void = useCallback(
    (uuid: string, title?: string) => {
      openTab(uuid, title || DEFAULT_NOTE_TITLE)
      void qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
      if (isPhone) {
        setView('editor')
      }
    },
    [isPhone, openTab, qc, setView],
  )

  const handleCreateNote: () => void = useCallback(() => {
    createNote.mutate(
      {},
      {
        onSuccess: (newNote: INote) => {
          openTab(newNote.uuid, newNote.title || DEFAULT_NOTE_TITLE)
          if (isPhone) {
            setView('editor')
          }
        },
      },
    )
  }, [createNote, isPhone, openTab, setView])

  const headerSlot: React.JSX.Element = useMemo(() => <Header />, [])
  const navSlot: React.JSX.Element = useMemo(() => <Sidebar />, [])
  const listSlot: React.JSX.Element = useMemo(
    () => <NoteList activeUuid={activeUuid} onSelectNote={handleSelectNote} />,
    [activeUuid, handleSelectNote]
  )

  const editorSlot: React.JSX.Element = useMemo(
    () => (
      <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <TabBar />
        {isLoading ? (
          <Box p="xl" style={{ flex: 1, overflowY: 'auto' }}>
            <EditorSkeleton />
          </Box>
        ) : note ? (
          <EditorBoundary noteUuid={note.uuid}>
            <Editor key={note.uuid} note={note} />
          </EditorBoundary>
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

  const statusSlot: React.JSX.Element = useMemo(
    () => (
      <StatusBar
        folderPath={note?.folder?.name ?? null}
        words={note?.wordCount ?? 0}
      />
    ),
    [note?.wordCount, note?.folder?.name]
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
