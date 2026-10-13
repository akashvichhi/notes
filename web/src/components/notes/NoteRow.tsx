import { memo, useMemo } from 'react'

import { ActionIcon, Badge, Group, Menu, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconDots, IconStar, IconStarFilled } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'


import classes from '@/components/layout/shell.module.css'
import type { NoteListItem } from '@/types/api'

dayjs.extend(relativeTime)

export const NoteRow = memo(function NoteRow({
  note,
  active,
  onOpen,
  onStar,
  onTrash,
  onRename,
  onDuplicate,
  onMoveToFolder,
  onRestore,
  onRestoreTo,
  onForceDelete,
}: {
  note: NoteListItem
  active: boolean
  onOpen: () => void
  onStar: () => void
  onTrash: () => void
  onRename?: () => void
  onDuplicate: () => void
  onMoveToFolder?: () => void
  onRestore?: () => void
  onRestoreTo?: () => void
  onForceDelete?: () => void
}) {
  const updatedAgo = useMemo(() => dayjs(note.updated_at).fromNow(), [note.updated_at])
  const autoDeletedAgo = useMemo(
    () => (note.deleted_at ? dayjs(note.deleted_at).add(30, 'day').fromNow() : null),
    [note.deleted_at],
  )
  return (
    <UnstyledButton
      className={classes.noteRow}
      p="xs"
      style={{
        display:      'block',
        width:        '100%',
        borderRadius: 'var(--mantine-radius-md)',
        borderLeft:   `3px solid ${active ? 'var(--mantine-color-blue-6)' : 'transparent'}`,
        background:   active ? 'var(--mantine-color-blue-light)' : undefined,
        minHeight:    44,
      }}
      onClick={onOpen}
    >
      <Stack gap={3}>
        <Group gap={6} wrap="nowrap">
          <Text truncate fw={500} size="sm" style={{ flex: 1 }}>
            {note.title || 'New note'}
          </Text>

          {!note.deleted_at && (
            <ActionIcon
              aria-label={note.is_starred ? 'Unstar' : 'Star'}
              className={classes.rowAction}
              component="div"
              size="sm"
              style={note.is_starred ? { opacity: 1 } : undefined}
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation()
                onStar()
              }}
            >
              {note.is_starred ? (
                <IconStarFilled color="var(--mantine-color-yellow-6)" size={14} />
              ) : (
                <IconStar size={14} />
              )}
            </ActionIcon>
          )}

          <Menu withinPortal position="bottom-end">
            <Menu.Target>
              <ActionIcon
                aria-label="Note actions"
                className={classes.rowAction}
                component="div"
                size="sm"
                variant="subtle"
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
                  {autoDeletedAgo && (
                    <Text c="dimmed" pb="xs" px="sm" size="xs">
                      Auto-deleted {autoDeletedAgo}.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Menu.Item onClick={onRename}>Rename</Menu.Item>
                  <Menu.Item onClick={onMoveToFolder}>Move to folder…</Menu.Item>
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

        <Text truncate c="dimmed" size="xs">
          {note.excerpt}
        </Text>

        <Group gap={6}>
          <Text c="dimmed" size="xs">
            {updatedAgo}
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
})
