import { ActionIcon, Box, Group, Menu, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'

import { useTabsStore } from '@/stores/tabsStore'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useIsPhone } from '@/hooks/useIsPhone'

export function TabBar() {
  const isPhone = useIsPhone()
  const { tabs, activeUuid, activate, close, closeOthers, closeAll, reopen } = useTabsStore()
  const createNote = useCreateNote()

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
          {tabs.map((tab) => {
            const isActive = tab.uuid === activeUuid

            return (
              <Menu key={tab.uuid} position="bottom-start" shadow="md">
                <Menu.Target>
                  <UnstyledButton
                    onClick={() => activate(tab.uuid)}
                    px="xs"
                    h={28}
                    style={{
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
                      onClick={(e) => {
                        e.stopPropagation()
                        close(tab.uuid)
                      }}
                      aria-label="Close tab"
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Item onClick={() => close(tab.uuid)}>Close</Menu.Item>
                  <Menu.Item onClick={() => closeOthers(tab.uuid)}>Close others</Menu.Item>
                  <Menu.Item onClick={closeAll}>Close all</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item onClick={reopen}>Reopen closed tab</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )
          })}
        </Group>
      </ScrollArea>

      <ActionIcon
        size="sm"
        variant="subtle"
        onClick={() => createNote.mutate({})}
        aria-label="New note tab"
      >
        <IconPlus size={14} />
      </ActionIcon>
    </Group>
  )
}
