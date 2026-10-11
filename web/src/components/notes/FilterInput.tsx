import { Loader, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconFilter } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { fetchNotes } from '@/api/notes'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useUiStore } from '@/stores/uiStore'

/**
 * Hybrid filter. Loaded rows are filtered instantly with no loader; if the scope
 * has further pages, a scoped server query tops up the results. Filtering only
 * the loaded page would silently miss notes and make them look deleted.
 */
export function FilterInput({
  hasMore, localCount, totalCount, params,
}: {
  hasMore: boolean; localCount: number; totalCount: number
  params: Record<string, string | undefined>
}) {
  const { filter, setFilter, scope } = useUiStore()
  const [debounced] = useDebouncedValue(filter, 250)

  const server = useQuery({
    queryKey: ['notes-filter', scope, debounced],
    queryFn: () => fetchNotes({ ...params, q: debounced }),
    enabled: hasMore && debounced.trim().length > 0,
  })

  const showSpinner = useDelayedLoading(server.isFetching)

  return (
    <TextInput
      value={filter}
      onChange={(e) => setFilter(e.currentTarget.value)}
      // Naming the scope is what stops this reading as a second search box.
      placeholder={`Filter in ${scope.label}`}
      leftSection={<IconFilter size={15} />}
      rightSection={
        showSpinner ? <Loader size={14} />
          : filter ? <Text size="xs" c="dimmed">{localCount} of {totalCount}</Text>
          : null
      }
      rightSectionWidth={filter ? 64 : 36}
    />
  )
}
