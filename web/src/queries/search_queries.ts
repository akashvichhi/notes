import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { search } from '@src/api/search_api'
import { MIN_SEARCH_QUERY_LENGTH } from '@src/constants/limits'
import { queryKeys } from '@src/constants/query_keys'
import type { ISearchResults } from '@src/types/api'



/** MySQL's innodb_ft_min_token_size: below this the server cannot match anything. */
export const MIN_QUERY: number = MIN_SEARCH_QUERY_LENGTH

export function useSearch(q: string): UseQueryResult<ISearchResults, IApiError> {
  const trimmed: string = q.trim()

  return useQuery({
    queryKey:        queryKeys.search(trimmed),
    queryFn:         ({ signal }: { signal: AbortSignal }): Promise<ISearchResults> => search(trimmed, signal),
    enabled:         trimmed.length >= MIN_QUERY,
    placeholderData: keepPreviousData,
  })
}
