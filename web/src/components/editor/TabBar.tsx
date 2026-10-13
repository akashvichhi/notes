import { ActionIcon, Box, Group, Menu, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'
import { memo, useCallback } from 'react'

import { useTabsStore } from '@/stores/tabsStore'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useIsPhone } from '@/hooks/useIsPhone'
import type { Tab } from '@/stores/tabsStore'

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

  return (
    <Menu position="bottom-start" shadow="md">
      <Menu.Target>
        <UnstyledButton
          component="div"
          role="button"
          tabIndex={0}
          onClick={handleActivate}
          onKeyDown={handleKeyDown}
          px="xs"
          h={28}
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--mantine-radius-sm)',
            background: isActive ? 'var(--mantine-color-default-hover)' : 'transparent',
            border: '1px solid',
            borderColor: isActive
              ? 'var(--mantine-color-default-border)'
              : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {tab.dirty && (
            <Box
              w={6}
              h={6}
              bg="yellow.6"
              style={{ borderRadius: '50%', flexShrink: 0 }}
            />
          )}
          <Text size="xs" truncate maw={140} fw={isActive ? 600 : 400}>
            {tab.title || 'Untitled'}
          </Text>
          <ActionIcon
            size={16}
            variant="subtle"
            color="gray"
            onClick={handleClose}
            aria-label="Close tab"
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
      h={36}
      px="xs"
      gap={4}
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        overflow: 'hidden',
      }}
    >
      <ScrollArea type="never" style={{ flex: 1 }}>
        <Group gap={4} wrap="nowrap">
          {tabs.map((tab) => (
            <TabItem
              key={tab.uuid}
              tab={tab}
              isActive={tab.uuid === activeUuid}
              onActivate={handleActivate}
              onClose={handleClose}
              onCloseOthers={handleCloseOthers}
              onCloseAll={closeAll}
              onReopen={reopen}
            />
          ))}
        </Group>
      </ScrollArea>

      <ActionIcon
        size="sm"
        variant="subtle"
        onClick={handleCreateNote}
        aria-label="New note tab"
      >
        <IconPlus size={14} />
      </ActionIcon>
    </Group>
  )
})
