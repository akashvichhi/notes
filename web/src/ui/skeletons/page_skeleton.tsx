import { Center, Skeleton, Stack } from '@mantine/core'

/** Stand-in for a single-column page (sign-in, tokens) while its code loads. */
export function PageSkeleton(): React.JSX.Element {
  return (
    <Center h="100dvh" p="md">
      <Stack gap="md" maw={420} w="100%">
        <Skeleton h={28} w="50%" />
        <Skeleton h={36} />
        <Skeleton h={36} />
        <Skeleton h={36} w="40%" />
      </Stack>
    </Center>
  )
}
