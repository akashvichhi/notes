import { Box, Text } from '@mantine/core'
import { AppShellLayout } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'

export function AppPage() {
  return (
    <AppShellLayout
      header={<Header />}
      nav={
        <Box p="md">
          <Text size="sm" fw={600} mb="xs">Navigation</Text>
          <Text size="sm" c="dimmed">Folders & Tags</Text>
        </Box>
      }
      list={
        <Box p="md">
          <Text size="sm" fw={600} mb="xs">Notes</Text>
          <Text size="sm" c="dimmed">Select a note to read or edit</Text>
        </Box>
      }
      editor={
        <Box p="xl">
          <Text size="sm" c="dimmed">No note selected</Text>
        </Box>
      }
      status={<StatusBar />}
    />
  )
}
