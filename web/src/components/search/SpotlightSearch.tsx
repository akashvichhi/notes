import { memo, useCallback, useMemo, useState } from 'react'

import { Progress, Text } from '@mantine/core'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { IconFolder, IconNote, IconPlus, IconSearch } from '@tabler/icons-react'


import { useCreateNote } from '@/hooks/queries/useNotes'
import { MIN_QUERY, useSearch } from '@/hooks/queries/useSearch'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'

import { HighlightTerms } from './Highlight'

export const SpotlightSearch = memo(function SpotlightSearch() {
  const [query, setQuery] = useState('')
  const { data, isFetching } = useSearch(query)
  const showBar = useDelayedLoading(isFetching)
  const openTab = useTabsStore((s) => s.open)
  const setScope = useUiStore((s) => s.setScope)
  const createNote = useCreateNote()

  const trimmedQuery = useMemo(() => query.trim(), [query])
  const short = useMemo(
    () => trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY,
    [trimmedQuery],
  )

  const handleSeeAllResults = useCallback(() => {
    // Hand off to the list pane instead of competing with it.
    setScope({ kind: 'search', q: trimmedQuery, label: `Results for “${trimmedQuery}”` })
    spotlight.close()
  }, [setScope, trimmedQuery])

  const handleCreateEmptyNote = useCallback(() => {
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

        {data?.notes.map((hit) => (
          <Spotlight.Action key={hit.uuid} leftSection={<IconNote size={18} />}
            onClick={() => openTab(hit.uuid, hit.title)}>
            <div>
              <Text fw={500} size="sm"><HighlightTerms terms={hit.terms} text={hit.title} /></Text>
              <Text c="dimmed" size="xs"><HighlightTerms terms={hit.terms} text={hit.snippet} /></Text>
            </div>
          </Spotlight.Action>
        ))}

        {data?.folders.map((f) => (
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
