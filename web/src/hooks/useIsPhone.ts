import { useMediaQuery } from '@mantine/hooks'

export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 767px)') ?? false
}
