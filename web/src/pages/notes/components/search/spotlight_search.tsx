import { memo, useCallback, useMemo, useState } from 'react'

import { Progress, Text } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { IconFolder, IconNote, IconPlus, IconSearch } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@src/constants/query_keys'
import { useDelayedLoading } from '@src/pages/notes/hooks/use_delayed_loading'
import { useCreateNote } from '@src/queries/notes_queries'
import type { TCreateNoteMutation } from '@src/queries/notes_queries'
import { MIN_QUERY, useSearch } from '@src/queries/search_queries'
import { useTabsStore } from '@src/stores/tabs_store'
import type { ITabsState } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import type { TScope, IUiState } from '@src/stores/ui_store'
import type { ISearchHit, TUuid } from '@src/types/api'

import { HighlightTerms } from './highlight'


export const SpotlightSearch: React.MemoExoticComponent<() => React.JSX.Element> = memo(function SpotlightSearch() {
  const qc: QueryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const { data, isFetching } = useSearch(query)
  const showBar: boolean = useDelayedLoading(isFetching)
  const openTab: (uuid: TUuid, title: string) => void = useTabsStore((s: ITabsState) => s.open)
  const setScope: (s: TScope) => void = useUiStore((s: IUiState) => s.setScope)
  const createNote: TCreateNoteMutation = useCreateNote()

  const trimmedQuery: string = useMemo(() => query.trim(), [query])
  const short: boolean = useMemo(
    () => trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY,
    [trimmedQuery],
  )

  const handleSeeAllResults: () => void = useCallback(() => {
    // Hand off to the list pane instead of competing with it.
    setScope({ kind: 'search', q: trimmedQuery, label: `Results for “${trimmedQuery}”` })
    spotlight.close()
  }, [setScope, trimmedQuery])

  const handleCreateEmptyNote: () => void = useCallback(() => {
    createNote.mutate({})
  }, [createNote])

  return (
    <Spotlight.Root scrollable query={query} onQueryChange={setQuery}>
      <Spotlight.Search leftSection={<IconSearch size={18} />} placeholder="Search notes and actions…" />

      {/* Stale results stay visible and dim rather than vanishing. */}
      {showBar && <Progress animated size={2} value={100} />}

      <Spotlight.ActionsList style={{ opacity: isFetching ? 0.45 : 1 }}>
        {short && (
          <Text c="dimmed" p="md" size="sm" ta="center">Type at least {MIN_QUERY} characters</Text>
        )}

        {data?.notes.map((hit: ISearchHit) => (
          <Spotlight.Action key={hit.uuid} leftSection={<IconNote size={18} />}
            onClick={() => {
              openTab(hit.uuid, hit.title)
              void qc.invalidateQueries({ queryKey: queryKeys.notes.detail(hit.uuid) })
            }}>
            <div>
              <Text fw={500} size="sm"><HighlightTerms terms={hit.terms} text={hit.title} /></Text>
              <Text c="dimmed" size="xs"><HighlightTerms terms={hit.terms} text={hit.snippet} /></Text>
            </div>
          </Spotlight.Action>
        ))}

        {data?.folders.map((f: { uuid: TUuid; name: string; }) => (
          <Spotlight.Action key={f.uuid} leftSection={<IconFolder size={18} />}
            onClick={() => setScope({ kind: 'folder', uuid: f.uuid, label: f.name })}>
            {f.name}
          </Spotlight.Action>
        ))}

        {trimmedQuery.length >= MIN_QUERY && (
          <Spotlight.Action
            leftSection={<IconSearch size={18} />}
            onClick={handleSeeAllResults}
          >
            See all results for “{trimmedQuery}”
          </Spotlight.Action>
        )}

        {data && data.notes.length === 0 && trimmedQuery.length >= MIN_QUERY && (
          <Spotlight.Action leftSection={<IconPlus size={18} />} onClick={handleCreateEmptyNote}>
            No results — create note “{trimmedQuery}”
          </Spotlight.Action>
        )}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  )
})
