import { useQuery } from '@tanstack/react-query'

import { search } from '@/api/search'

/** MySQL's innodb_ft_min_token_size: below this the server cannot match anything. */
export const MIN_QUERY = 3

export function useSearch(q: string) {
  const trimmed = q.trim()

  return useQuery({
    queryKey:        ['search', trimmed],
    // The query key is the search string, so an out-of-order response can
    // never overwrite a newer one. The signal aborts superseded keystrokes.
    queryFn:         ({ signal }) => search(trimmed, signal),
    enabled:         trimmed.length >= MIN_QUERY,
    // Stale results stay on screen while the next query runs.
    placeholderData: (previous) => previous,
  })
}
