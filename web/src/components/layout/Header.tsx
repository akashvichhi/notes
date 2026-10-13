import { ActionIcon, Center, Group, Text, UnstyledButton, useMantineColorScheme } from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import {
  IconChevronLeft, IconMenu2, IconMoon, IconNotes, IconSearch, IconSun,
} from '@tabler/icons-react'

import { memo, useCallback } from 'react'

import { useIsPhone } from '@/hooks/useIsPhone'
import { useUiStore } from '@/stores/uiStore'

import { AccountMenu } from './AccountMenu'

export const Header = memo(function Header() {
  const isPhone = useIsPhone()
  const { view, setView, toggleNav, scope } = useUiStore()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()

  const handleBack = useCallback(() => {
    setView(view === 'editor' ? 'list' : 'folders')
  }, [view, setView])

  const handleOpenSpotlight = useCallback(() => {
    spotlight.open()
  }, [])

  return (
    <Group gap="sm" h={52} px="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      {isPhone ? (
        <ActionIcon
          aria-label="Back" size="lg" style={{ visibility: view === 'folders' ? 'hidden' : 'visible' }}
          variant="subtle"
          onClick={handleBack}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
      ) : (
        // The sidebar toggle sits next to what it controls, at the far left.
        <ActionIcon aria-label="Toggle sidebar" size="lg" variant="subtle" onClick={toggleNav}>
          <IconMenu2 size={18} />
        </ActionIcon>
      )}

      {/* Brand mark: the favicon's shape, drawn with the icon set already
          installed. No image asset, so it stays crisp and follows the theme. */}
      <Group gap={8} visibleFrom="sm" wrap="nowrap">
        <Center bg="blue.6" h={26} style={{ borderRadius: 7, flex: 'none' }} w={26}>
          <IconNotes color="white" size={16} stroke={2} />
        </Center>
        <Text fw={600} size="sm">Notes</Text>
      </Group>
      {isPhone && <Text truncate fw={600} size="md" style={{ flex: 1 }}>{scope.label}</Text>}

      <UnstyledButton
        aria-label="Search notes and actions"
        style={{ flex: 1, maxWidth: 460 }}
        visibleFrom="sm"
        onClick={handleOpenSpotlight}
      >
        <Group gap="xs" h={32} px="sm" style={{
          border:       '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}>
          <IconSearch opacity={0.6} size={15} />
          <Text c="dimmed" size="sm" style={{ flex: 1 }}>Search notes and actions…</Text>
          <Text c="dimmed" size="xs">⌘K</Text>
        </Group>
      </UnstyledButton>

      {isPhone && (
        <ActionIcon aria-label="Search" size="lg" variant="subtle" onClick={handleOpenSpotlight}>
          <IconSearch size={18} />
        </ActionIcon>
      )}

      <Group gap={4} ml="auto">
        <ActionIcon aria-label="Toggle colour scheme" size="lg" variant="subtle" onClick={toggleColorScheme}>
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <AccountMenu />
      </Group>
    </Group>
  )
})
