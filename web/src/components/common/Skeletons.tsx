import { Box, Group, Skeleton, Stack } from '@mantine/core'

import { memo, useMemo } from 'react'

export const ListSkeleton = memo(function ListSkeleton({ rows = 6 }: { rows?: number }) {
  const rowList = useMemo(() => Array.from({ length: rows }, (_, i) => i), [rows])

  return (
    <Stack gap="md">
      {rowList.map((i) => (
        <Stack key={i} gap={6}>
          <Skeleton h={12} w="55%" /><Skeleton h={9} w="85%" /><Skeleton h={8} w="30%" />
        </Stack>
      ))}
    </Stack>
  )
})

export const EditorSkeleton = memo(function EditorSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton h={26} w="45%" />
      <Skeleton h={11} /><Skeleton h={11} /><Skeleton h={11} w="80%" />
    </Stack>
  )
})

/** The shape of the loaded app, so nothing jumps when data arrives. */
export const AppSkeleton = memo(function AppSkeleton() {
  return (
    <Box h="100dvh" style={{ display: 'grid', gridTemplateRows: '52px 1fr 28px' }}>
      <Group h={52} px="sm"><Skeleton h={24} w={120} /></Group>
      <Group align="stretch" gap={0}>
        <Stack gap="xs" p="sm" visibleFrom="md" w={232}>
          <Skeleton h={34} /><Skeleton h={18} mt="md" w="60%" />
          <Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} />
        </Stack>
        <Box p="sm" visibleFrom="sm" w={300}><ListSkeleton /></Box>
        <Box p="xl" style={{ flex: 1 }}><EditorSkeleton /></Box>
      </Group>
      <Box />
    </Box>
  )
})
