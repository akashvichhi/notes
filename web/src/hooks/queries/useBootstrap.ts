import { useQuery } from '@tanstack/react-query'
import { fetchBootstrap } from '@/api/bootstrap'

export const BOOTSTRAP_KEY = ['bootstrap'] as const

export function useBootstrap() {
  const query = useQuery({ queryKey: BOOTSTRAP_KEY, queryFn: fetchBootstrap })

  return {
    ...query,
    user: query.data?.user.data ?? null,
    folders: query.data?.folders.data ?? [],
    tags: query.data?.tags.data ?? [],
    counts: query.data?.counts ?? null,
    initialNotes: query.data?.notes.data ?? [],
  }
}
