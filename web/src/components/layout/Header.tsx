import { ActionIcon, Center, Group, Text, UnstyledButton, useMantineColorScheme } from '@mantine/core'
import {
  IconChevronLeft, IconMenu2, IconMoon, IconNotes, IconSearch, IconSun,
} from '@tabler/icons-react'
import { spotlight } from '@mantine/spotlight'

import { useIsPhone } from './AppShell'
import { AccountMenu } from './AccountMenu'
import { useUiStore } from '@/stores/uiStore'

export function Header() {
  const isPhone = useIsPhone()
  const { view, setView, toggleNav, scope } = useUiStore()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()

  return (
    <Group h={52} px="sm" gap="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      {isPhone ? (
        <ActionIcon
          variant="subtle" size="lg" aria-label="Back"
          style={{ visibility: view === 'folders' ? 'hidden' : 'visible' }}
          onClick={() => setView(view === 'editor' ? 'list' : 'folders')}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
      ) : (
        // The sidebar toggle sits next to what it controls, at the far left.
        <ActionIcon variant="subtle" size="lg" aria-label="Toggle sidebar" onClick={toggleNav}>
          <IconMenu2 size={18} />
        </ActionIcon>
      )}

      {/* Brand mark: the favicon's shape, drawn with the icon set already
          installed. No image asset, so it stays crisp and follows the theme. */}
      <Group gap={8} visibleFrom="sm" wrap="nowrap">
        <Center w={26} h={26} bg="blue.6" style={{ borderRadius: 7, flex: 'none' }}>
          <IconNotes size={16} color="white" stroke={2} />
        </Center>
        <Text fw={600} size="sm">Notes</Text>
      </Group>
      {isPhone && <Text fw={600} size="md" truncate style={{ flex: 1 }}>{scope.label}</Text>}

      <UnstyledButton
        onClick={spotlight.open}
        style={{ flex: 1, maxWidth: 460 }}
        visibleFrom="sm"
        aria-label="Search notes and actions"
      >
        <Group gap="xs" px="sm" h={32} style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}>
          <IconSearch size={15} opacity={0.6} />
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>Search notes and actions…</Text>
          <Text size="xs" c="dimmed">⌘K</Text>
        </Group>
      </UnstyledButton>

      {isPhone && (
        <ActionIcon variant="subtle" size="lg" onClick={spotlight.open} aria-label="Search">
          <IconSearch size={18} />
        </ActionIcon>
      )}

      <Group gap={4} ml="auto">
        <ActionIcon variant="subtle" size="lg" onClick={toggleColorScheme} aria-label="Toggle colour scheme">
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <AccountMenu />
      </Group>
    </Group>
  )
}
