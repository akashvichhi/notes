import { Box } from '@mantine/core'
import { useIsFetching } from '@tanstack/react-query'
import { useDelayedLoading } from '@/lib/useDelayedLoading'

/** Catch-all indicator for fetches with no better home. Never blocks. */
export function TopProgress() {
  const show = useDelayedLoading(useIsFetching() > 0)
  if (!show) return null

  return (
    <Box
      pos="fixed" top={0} left={0} right={0} h={2} bg="blue.5"
      style={{ zIndex: 1000, animation: 'pulse 1s ease-in-out infinite' }}
    />
  )
}
