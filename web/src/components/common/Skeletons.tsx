import { Box, Flex, Skeleton, Stack } from '@mantine/core'

export function AppSkeleton() {
  return (
    <Flex h="100dvh" w="100vw">
      <Box w={260} p="md" style={{ borderRight: '1px solid var(--mantine-color-default-border)' }}>
        <Stack gap="sm">
          <Skeleton height={36} radius="sm" />
          <Skeleton height={24} radius="sm" mt="md" />
          <Skeleton height={24} radius="sm" />
          <Skeleton height={24} radius="sm" />
        </Stack>
      </Box>
      <Box w={320} p="md" style={{ borderRight: '1px solid var(--mantine-color-default-border)' }}>
        <Stack gap="sm">
          <Skeleton height={36} radius="sm" />
          <Skeleton height={60} radius="sm" mt="md" />
          <Skeleton height={60} radius="sm" />
          <Skeleton height={60} radius="sm" />
        </Stack>
      </Box>
      <Box style={{ flex: 1 }} p="xl">
        <Skeleton height={40} width="40%" radius="sm" mb="xl" />
        <Skeleton height={20} radius="sm" mb="sm" />
        <Skeleton height={20} radius="sm" mb="sm" />
        <Skeleton height={20} width="70%" radius="sm" />
      </Box>
    </Flex>
  )
}
