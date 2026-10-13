import { Loader, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconFilter } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { memo, useCallback, useMemo } from 'react'

import { fetchNotes } from '@/api/notes'
import { useDelayedLoading } from '@/lib/useDelayedLoading'
import { useUiStore } from '@/stores/uiStore'

/**
 * Hybrid filter. Loaded rows are filtered instantly with no loader; if the scope
 * has further pages, a scoped server query tops up the results. Filtering only
 * the loaded page would silently miss notes and make them look deleted.
 */
export const FilterInput = memo(function FilterInput({
  hasMore, localCount, totalCount, params,
}: {
  hasMore: boolean; localCount: number; totalCount: number
  params: Record<string, string | undefined>
}) {
  const { filter, setFilter, scope } = useUiStore()
  const [debounced] = useDebouncedValue(filter, 250)

  const server = useQuery({
    queryKey: ['notes-filter', scope, debounced],
    queryFn:  () => fetchNotes({ ...params, q: debounced }),
    enabled:  hasMore && debounced.trim().length > 0,
  })

  const showSpinner = useDelayedLoading(server.isFetching)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.currentTarget.value)
    },
    [setFilter],
  )

  const placeholder = useMemo(() => `Filter in ${scope.label}`, [scope.label])

  const rightSection = useMemo(() => {
    if (showSpinner) return <Loader size={14} />
    if (filter) return <Text c="dimmed" size="xs">{localCount} of {totalCount}</Text>
    return null
  }, [showSpinner, filter, localCount, totalCount])

  return (
    <TextInput
      leftSection={<IconFilter size={15} />}
      placeholder={placeholder}
      rightSection={rightSection}
      rightSectionWidth={filter ? 64 : 36}
      value={filter}
      onChange={handleChange}
    />
  )
})
