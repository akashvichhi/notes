import { memo, useCallback, useMemo } from 'react'

import { Loader, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconFilter } from '@tabler/icons-react'
import type { UseQueryResult } from '@tanstack/react-query'

import type { TNotesPage } from '@src/api/notes_api'
import { useDelayedLoading } from '@src/pages/notes/hooks/use_delayed_loading'
import { type IScopeFilter, useScopeFilter } from '@src/pages/notes/hooks/use_scope_filter'
import { useNotesFilterQuery } from '@src/queries/notes_queries'
import type { TScope } from '@src/types/scope'

/**
 * Hybrid filter. Loaded rows are filtered instantly with no loader; if the scope
 * has further pages, a scoped server query tops up the results. Filtering only
 * the loaded page would silently miss notes and make them look deleted.
 */
export interface IFilterInputProps {
  scope:      TScope
  scopeLabel: string
  hasMore:    boolean
  localCount: number
  totalCount: number
}

export const FilterInput: React.NamedExoticComponent<IFilterInputProps> = memo(function FilterInput({
  scope, scopeLabel, hasMore, localCount, totalCount,
}: IFilterInputProps): React.JSX.Element {
  const { filter, setFilter }: IScopeFilter = useScopeFilter(scope)
  const [debounced] = useDebouncedValue(filter, 250)

  const server: UseQueryResult<TNotesPage> = useNotesFilterQuery(scope, debounced, hasMore && debounced.trim().length > 0)

  const showSpinner: boolean = useDelayedLoading(server.isFetching)

  const handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.currentTarget.value)
    },
    [setFilter],
  )

  const placeholder: string = useMemo(() => `Filter in ${scopeLabel}`, [scopeLabel])

  const rightSection: React.JSX.Element | null = useMemo(() => {
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
