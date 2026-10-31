import { memo, useMemo } from 'react'

import { ActionIcon, Badge, Box, Group, Menu, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconDots, IconStar, IconStarFilled } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'


import classes from '@/components/layout/shell.module.css'
import { DEFAULT_NOTE_TITLE } from '@/constants/labels'
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
  return (
    <Box
      className={classes.noteRow}
      p="xs"
      style={{
        position:     'relative',
        display:      'block',
        width:        '100%',
        borderRadius: 'var(--mantine-radius-md)',
        background:   active ? 'var(--mantine-color-blue-light)' : undefined,
        minHeight:    44,
      }}
    >
      {/* Background click overlay for opening note */}
      <UnstyledButton
        aria-label={`Open note ${note.title || DEFAULT_NOTE_TITLE}`}
        style={{
          position:     'absolute',
          inset:        0,
          width:        '100%',
          height:       '100%',
          zIndex:       1,
          borderRadius: 'var(--mantine-radius-md)',
          cursor:       'pointer',
        }}
        onClick={onOpen}
      />

      <Stack gap={3} style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
        <Group gap={6} wrap="nowrap">
          <Text truncate fw={500} size="sm" style={{ flex: 1 }}>
            {note.title || DEFAULT_NOTE_TITLE}
          </Text>

          {!note.deleted_at && (
            <ActionIcon
              aria-label={note.is_starred ? 'Unstar' : 'Star'}
              className={classes.rowAction}
              size="sm"
              style={{ pointerEvents: 'auto', ...(note.is_starred ? { opacity: 1 } : {}) }}
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

          <Box style={{ pointerEvents: 'auto' }}>
            <Menu withinPortal position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  aria-label="Note actions"
                  className={classes.rowAction}
                  size="sm"
                  variant="subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                {note.deleted_at ? (
                  <>
                    <Menu.Item onClick={onRestore}>Restore</Menu.Item>
                    <Menu.Item onClick={onRestoreTo}>Restore to…</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        onForceDelete?.()
                      }}
                    >
                      Delete permanently
                    </Menu.Item>
                  </>
                ) : (
                  <>
                    <Menu.Item onClick={onRename}>Rename</Menu.Item>
                    <Menu.Item onClick={onMoveToFolder}>Move to folder…</Menu.Item>
                    <Menu.Item onClick={onStar}>{note.is_starred ? 'Unstar' : 'Star'}</Menu.Item>
                    <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        onTrash()
                      }}
                    >
                      Move to trash
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Box>
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
    </Box>
  )
})
