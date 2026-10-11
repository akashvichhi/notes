import { Group, Text } from '@mantine/core'

export function StatusBar() {
  return (
    <Group
      h={28}
      px="sm"
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        fontSize: '11px',
      }}
      justify="space-between"
    >
      <Text size="xs" c="dimmed">
        Ready
      </Text>
      <Text size="xs" c="dimmed">
        Cloud sync active
      </Text>
    </Group>
  )
}
