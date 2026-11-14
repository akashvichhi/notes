import { memo, useCallback } from 'react'

import { ActionIcon, Group, Loader, Menu, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { DEFAULT_NOTE_TITLE } from '@src/constants/labels'
import { queryKeys } from '@src/constants/query_keys'
import { useIsPhone } from '@src/hooks/use_is_phone'
import { useCreateNote } from '@src/queries/notes_queries'
import type { TCreateNoteMutation } from '@src/queries/notes_queries'
import { useTabsStore } from '@src/stores/tabs_store'
import type { ITab } from '@src/stores/tabs_store'
import { useUiStore } from '@src/stores/ui_store'
import type { TSaveStatus, IUiState } from '@src/stores/ui_store'

interface ITabItemProps {
  tab:           ITab
  isActive:      boolean
  onActivate:    (uuid: string) => void
  onClose:       (uuid: string) => void
  onCloseOthers: (uuid: string) => void
  onCloseAll:    () => void
  onReopen:      () => void
}

const TabItem: React.MemoExoticComponent<({ tab, isActive, onActivate, onClose, onCloseOthers, onCloseAll, onReopen, }: ITabItemProps) => React.JSX.Element> = memo(function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onReopen,
}: ITabItemProps) {
  const handleActivate: () => void = useCallback(() => {
    onActivate(tab.uuid)
  }, [onActivate, tab.uuid])

  const handleClose: (e: React.MouseEvent) => void = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(tab.uuid)
    },
    [onClose, tab.uuid]
  )

  const handleMenuClose: () => void = useCallback(() => {
    onClose(tab.uuid)
  }, [onClose, tab.uuid])

  const handleMenuCloseOthers: () => void = useCallback(() => {
    onCloseOthers(tab.uuid)
  }, [onCloseOthers, tab.uuid])

  const handleKeyDown: (e: React.KeyboardEvent) => void = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleActivate()
      }
    },
    [handleActivate]
  )

  const saveStatus: TSaveStatus = useUiStore((s: IUiState) => s.saveStatus)
  const isSaving: boolean = isActive && saveStatus === 'saving'

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
            {tab.title || DEFAULT_NOTE_TITLE}
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

export const TabBar: React.MemoExoticComponent<() => React.JSX.Element | null> = memo(function TabBar() {
  const isPhone: boolean = useIsPhone()
  const { tabs, activeUuid, activate, close, closeOthers, closeAll, reopen } = useTabsStore()
  const createNote: TCreateNoteMutation = useCreateNote()
  const qc: QueryClient = useQueryClient()
  const handleActivate: (uuid: string) => void = useCallback(
    (uuid: string) => {
      activate(uuid)
      void qc.invalidateQueries({ queryKey: queryKeys.notes.detail(uuid) })
    },
    [activate, qc],
  )
  const handleClose: (uuid: string) => void = useCallback((uuid: string) => close(uuid), [close])
  const handleCloseOthers: (uuid: string) => void = useCallback((uuid: string) => closeOthers(uuid), [closeOthers])
  const handleCreateNote: () => void = useCallback(() => {
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
          {tabs.map((tab: ITab) => (
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
