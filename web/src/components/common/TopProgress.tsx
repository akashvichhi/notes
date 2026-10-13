import { memo } from 'react'

import { Box } from '@mantine/core'
import { useIsFetching } from '@tanstack/react-query'


import { useDelayedLoading } from '@/lib/useDelayedLoading'

/** Catch-all indicator for fetches with no better home. Never blocks. */
export const TopProgress = memo(function TopProgress() {
  const show = useDelayedLoading(useIsFetching() > 0)
  if (!show) return null

  return (
    <Box
      bg="blue.5" h={2} left={0} pos="fixed" right={0} style={{ zIndex: 1000, animation: 'pulse 1s ease-in-out infinite' }}
      top={0}
    />
  )
})
