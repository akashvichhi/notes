import { ActionIcon, Badge, Group, Menu, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconDots, IconStar, IconStarFilled } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import type { NoteListItem } from '@/types/api'
import classes from '../layout/shell.module.css'

dayjs.extend(relativeTime)

export function NoteRow({
  note,
  active,
  onOpen,
  onStar,
  onTrash,
  onDuplicate,
  onRestore,
  onRestoreTo,
  onForceDelete,
}: {
  note: NoteListItem
  active: boolean
  onOpen: () => void
  onStar: () => void
  onTrash: () => void
  onDuplicate: () => void
  onRestore?: () => void
  onRestoreTo?: () => void
  onForceDelete?: () => void
}) {
  return (
    <UnstyledButton
      onClick={onOpen}
      p="xs"
      style={{
        display: 'block',
        width: '100%',
        borderRadius: 'var(--mantine-radius-md)',
        borderLeft: `3px solid ${active ? 'var(--mantine-color-blue-6)' : 'transparent'}`,
        background: active ? 'var(--mantine-color-blue-light)' : undefined,
        minHeight: 44,
      }}
    >
      <Stack gap={3}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
            {note.title || 'New note'}
          </Text>

          {!note.deleted_at && (
            <ActionIcon
              component="div"
              size="sm"
              variant="subtle"
              aria-label={note.is_starred ? 'Unstar' : 'Star'}
              className={classes.rowAction}
              style={{ opacity: note.is_starred ? 1 : 0 }}
              onClick={(e) => {
                e.stopPropagation()
                onStar()
              }}
            >
              {note.is_starred ? (
                <IconStarFilled size={14} color="var(--mantine-color-yellow-6)" />
              ) : (
                <IconStar size={14} />
              )}
            </ActionIcon>
          )}

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                component="div"
                size="sm"
                variant="subtle"
                aria-label="Note actions"
                className={classes.rowAction}
                style={{ opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {note.deleted_at ? (
                <>
                  <Menu.Item onClick={onRestore}>Restore</Menu.Item>
                  <Menu.Item onClick={onRestoreTo}>Restore to…</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={onForceDelete}>
                    Delete permanently
                  </Menu.Item>
                  {/* The retention clock only helps if it is visible while deciding. */}
                  <Text size="xs" c="dimmed" px="sm" pb="xs">
                    Auto-deleted {dayjs(note.deleted_at).add(30, 'day').fromNow()}.
                  </Text>
                </>
              ) : (
                <>
                  <Menu.Item onClick={onStar}>{note.is_starred ? 'Unstar' : 'Star'}</Menu.Item>
                  <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={onTrash}>
                    Move to trash
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text size="xs" c="dimmed" truncate>
          {note.excerpt}
        </Text>

        <Group gap={6}>
          <Text size="xs" c="dimmed">
            {dayjs(note.updated_at).fromNow()}
          </Text>
          {note.folder && (
            <Badge size="xs" variant="light">
              {note.folder.name}
            </Badge>
          )}
        </Group>
      </Stack>
    </UnstyledButton>
  )
}
