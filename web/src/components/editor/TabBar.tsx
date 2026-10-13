import { memo, useCallback } from 'react'

import { ActionIcon, Group, Loader, Menu, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'


import { useCreateNote } from '@/hooks/queries/useNotes'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useTabsStore } from '@/stores/tabsStore'
import type { Tab } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onActivate: (uuid: string) => void
  onClose: (uuid: string) => void
  onCloseOthers: (uuid: string) => void
  onCloseAll: () => void
  onReopen: () => void
}

const TabItem = memo(function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onReopen,
}: TabItemProps) {
  const handleActivate = useCallback(() => {
    onActivate(tab.uuid)
  }, [onActivate, tab.uuid])

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(tab.uuid)
    },
    [onClose, tab.uuid]
  )

  const handleMenuClose = useCallback(() => {
    onClose(tab.uuid)
  }, [onClose, tab.uuid])

  const handleMenuCloseOthers = useCallback(() => {
    onCloseOthers(tab.uuid)
  }, [onCloseOthers, tab.uuid])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleActivate()
      }
    },
    [handleActivate]
  )

  const saveStatus = useUiStore((s) => s.saveStatus)
  const isSaving = isActive && saveStatus === 'saving'

  return (
    <Menu position="bottom-start" shadow="md">
      <Menu.Target>
        <UnstyledButton
          component="div"
          h={28}
          px="xs"
          role="button"
          style={{
            cursor:       'pointer',
            borderRadius: 'var(--mantine-radius-sm)',
            background:   isActive ? 'var(--mantine-color-default-hover)' : 'transparent',
            border:       '1px solid',
            borderColor:  isActive
              ? 'var(--mantine-color-default-border)'
              : 'transparent',
            display:    'flex',
            alignItems: 'center',
            gap:        6,
          }}
          tabIndex={0}
          onClick={handleActivate}
          onKeyDown={handleKeyDown}
        >
          {isSaving && (
            <Loader size={10} style={{ flexShrink: 0 }} />
          )}
          <Text truncate fw={isActive ? 600 : 400} maw={140} size="xs">
            {tab.title || 'Untitled'}
          </Text>
          <ActionIcon
            aria-label="Close tab"
            color="gray"
            size={16}
            variant="subtle"
            onClick={handleClose}
          >
            <IconX size={10} />
          </ActionIcon>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item onClick={handleMenuClose}>Close</Menu.Item>
        <Menu.Item onClick={handleMenuCloseOthers}>Close others</Menu.Item>
        <Menu.Item onClick={onCloseAll}>Close all</Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={onReopen}>Reopen closed tab</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
})

export const TabBar = memo(function TabBar() {
  const isPhone = useIsPhone()
  const { tabs, activeUuid, activate, close, closeOthers, closeAll, reopen } = useTabsStore()
  const createNote = useCreateNote()

  const handleActivate = useCallback((uuid: string) => activate(uuid), [activate])
  const handleClose = useCallback((uuid: string) => close(uuid), [close])
  const handleCloseOthers = useCallback((uuid: string) => closeOthers(uuid), [closeOthers])
  const handleCreateNote = useCallback(() => {
    createNote.mutate({})
  }, [createNote])

  if (isPhone) return null

  return (
    <Group
      gap={4}
      h={36}
      px="xs"
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        overflow:     'hidden',
      }}
    >
      <ScrollArea style={{ flex: 1 }} type="never">
        <Group gap={4} wrap="nowrap">
          {tabs.map((tab) => (
            <TabItem
              key={tab.uuid}
              isActive={tab.uuid === activeUuid}
              tab={tab}
              onActivate={handleActivate}
              onClose={handleClose}
              onCloseAll={closeAll}
              onCloseOthers={handleCloseOthers}
              onReopen={reopen}
            />
          ))}
        </Group>
      </ScrollArea>

      <ActionIcon
        aria-label="New note tab"
        size="sm"
        variant="subtle"
        onClick={handleCreateNote}
      >
        <IconPlus size={14} />
      </ActionIcon>
    </Group>
  )
})
