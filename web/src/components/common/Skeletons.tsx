import { Box, Group, Skeleton, Stack } from '@mantine/core'

/** The shape of the loaded app, so nothing jumps when data arrives. */
export function AppSkeleton() {
  return (
    <Box h="100dvh" style={{ display: 'grid', gridTemplateRows: '52px 1fr 28px' }}>
      <Group px="sm" h={52}><Skeleton h={24} w={120} /></Group>
      <Group align="stretch" gap={0}>
        <Stack p="sm" w={232} gap="xs" visibleFrom="md">
          <Skeleton h={34} /><Skeleton h={18} w="60%" mt="md" />
          <Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} />
        </Stack>
        <Box w={300} p="sm" visibleFrom="sm"><ListSkeleton /></Box>
        <Box style={{ flex: 1 }} p="xl"><EditorSkeleton /></Box>
      </Group>
      <Box />
    </Box>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Stack gap="md">
      {Array.from({ length: rows }, (_, i) => (
        <Stack key={i} gap={6}>
          <Skeleton h={12} w="55%" /><Skeleton h={9} w="85%" /><Skeleton h={8} w="30%" />
        </Stack>
      ))}
    </Stack>
  )
}

export function EditorSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton h={26} w="45%" />
      <Skeleton h={11} /><Skeleton h={11} /><Skeleton h={11} w="80%" />
    </Stack>
  )
}
