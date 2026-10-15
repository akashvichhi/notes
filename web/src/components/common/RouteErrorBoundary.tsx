import { memo, useCallback, useEffect } from 'react'
import { useRouteError } from 'react-router'

import { Alert, Button, Center, Container, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'


export const RouteErrorBoundary = memo(function RouteErrorBoundary() {
  const error = useRouteError() as Error | null

  // Check if error is due to an outdated chunk 404 after a deployment
  const isChunkError =
    error?.message?.includes('Failed to fetch dynamically imported module')
    || error?.message?.includes('Loading chunk')
    || error?.name === 'ChunkLoadError'

  useEffect(() => {
    if (isChunkError) {
      const lastReload = sessionStorage.getItem('chunk_reload')
      const now = Date.now()
      if (!lastReload || now - Number(lastReload) > 10_000) {
        sessionStorage.setItem('chunk_reload', String(now))
        window.location.reload()
      }
    }
  }, [isChunkError])

  const handleReload = useCallback(() => {
    window.location.href = '/'
  }, [])

  return (
    <Center h="100dvh" p="md">
      <Container size="xs">
        <Stack align="center" gap="md" ta="center">
          <IconAlertTriangle color="var(--mantine-color-red-6)" size={48} />
          <Title order={3}>Something went wrong</Title>
          <Text c="dimmed" size="sm">
            An unexpected error occurred while loading this page.
          </Text>
          {error?.message && (
            <Alert color="red" style={{ textAlign: 'left', width: '100%' }} title="Error details">
              {error.message}
            </Alert>
          )}
          <Button leftSection={<IconRefresh size={16} />} onClick={handleReload}>
            Reload application
          </Button>
        </Stack>
      </Container>
    </Center>
  )
})
