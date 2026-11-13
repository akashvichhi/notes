import { memo, useCallback } from 'react'

import { ActionIcon, Group, Text, UnstyledButton, useMantineColorScheme } from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import {
  IconChevronLeft, IconDeviceFloppy, IconMenu2, IconMoon, IconRefresh, IconSearch, IconSun,
} from '@tabler/icons-react'


import { useIsPhone } from '@src/hooks/use_is_phone'
import { useRefreshFromServer } from '@src/pages/notes/hooks/use_refresh_from_server'
import { useMe } from '@src/queries/auth_queries'
import { useTabsStore } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'

import { AccountMenu } from './account_menu'


export const Header = memo(function Header() {
  const isPhone = useIsPhone()
  const { data: user } = useMe()
  const { view, setView, toggleNav, scope } = useUiStore()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.uuid === s.activeUuid))
  const isDirty = activeTab?.dirty ?? false
  const activeTitle = activeTab?.title
  const saveStatus = useUiStore((s) => s.saveStatus)
  const isNoteOpen = isPhone ? view === 'editor' && Boolean(activeTab) : Boolean(activeTab)

  const handleSave = useCallback(async () => {
    const retrySave = useUiStore.getState().retrySave
    if (retrySave) {
      await retrySave()
    } else {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))
    }
  }, [])

  const handleBack = useCallback(() => {
    setView(view === 'editor' ? 'list' : 'folders')
  }, [view, setView])

  const handleOpenSpotlight = useCallback(() => {
    spotlight.open()
  }, [])

  const { isRefreshing, refresh: handleRefresh } = useRefreshFromServer()

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

      {isPhone && (
        <Text truncate fw={600} size="md" style={{ flex: 1 }}>
          {view === 'editor' && activeTitle ? activeTitle : scope.label}
        </Text>
      )}

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
        {isNoteOpen && (
          <ActionIcon
            aria-label="Save note"
            color={isDirty ? 'blue' : undefined}
            disabled={saveStatus === 'saving'}
            loading={saveStatus === 'saving'}
            size="lg"
            title={isDirty ? 'Save note (Ctrl+S)' : 'Saved'}
            variant={isDirty ? 'light' : 'subtle'}
            onClick={handleSave}
          >
            <IconDeviceFloppy size={18} />
          </ActionIcon>
        )}
        {!!user && <ActionIcon
          aria-label="Refresh"
          loading={isRefreshing}
          size="lg"
          variant="subtle"
          onClick={handleRefresh}
        >
          <IconRefresh size={18} />
        </ActionIcon>}
        <ActionIcon aria-label="Toggle colour scheme" size="lg" variant="subtle" onClick={toggleColorScheme}>
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <AccountMenu />
      </Group>
    </Group>
  )
})
