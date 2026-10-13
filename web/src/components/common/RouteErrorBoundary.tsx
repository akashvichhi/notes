import { Alert, Button, Center, Container, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import { memo, useCallback } from 'react'
import { useRouteError } from 'react-router'

export const RouteErrorBoundary = memo(function RouteErrorBoundary() {
  const error = useRouteError() as Error | null

  const handleReload = useCallback(() => {
    window.location.href = '/'
  }, [])

  return (
    <Center h="100dvh" p="md">
      <Container size="xs">
        <Stack align="center" gap="md" ta="center">
          <IconAlertTriangle size={48} color="var(--mantine-color-red-6)" />
          <Title order={3}>Something went wrong</Title>
          <Text size="sm" c="dimmed">
            An unexpected error occurred while loading this page.
          </Text>
          {error?.message && (
            <Alert color="red" title="Error details" style={{ textAlign: 'left', width: '100%' }}>
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
