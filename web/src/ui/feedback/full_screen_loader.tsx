import { Center, Loader } from '@mantine/core'

/** Only while the session is checked on first load; everything else uses skeletons. */
export function FullScreenLoader(): React.JSX.Element {
  return (
    <Center aria-label="Loading" h="100dvh">
      <Loader size="md" />
    </Center>
  )
}
