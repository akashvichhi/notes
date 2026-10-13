import { memo, useCallback, useState } from 'react'

import { ActionIcon, Badge, Button, Group, Menu, NavLink, Stack, Text, TextInput } from '@mantine/core'
import {
  IconDots, IconFolder, IconNote, IconPlus, IconStar, IconTrash,
} from '@tabler/icons-react'


import { useBootstrap } from '@/hooks/queries/useBootstrap'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@/hooks/queries/useFolders'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useCreateTag, useDeleteTag } from '@/hooks/queries/useTags'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useUiStore } from '@/stores/uiStore'

export const Sidebar = memo(function Sidebar() {
  const { folders, tags, counts } = useBootstrap()
  const { scope, setScope, setView, closeNav } = useUiStore()
  const isPhone = useIsPhone()

  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()
  const createNote = useCreateNote()

  // Inline create, not a modal: naming a folder is one field.
  const [creating, setCreating] = useState<'folder' | 'tag' | null>(null)
  const [draftName, setDraftName] = useState('')

  const pick = useCallback(
    (next: Parameters<typeof setScope>[0]) => {
      setScope(next)
      closeNav()
      if (isPhone) setView('list')
    },
    [setScope, closeNav, isPhone, setView],
  )

  const commitInline = useCallback(() => {
    const name = draftName.trim()
    if (name) {
      if (creating === 'folder') {
        createFolder.mutate({ name })
      } else {
        createTag.mutate({ name })
      }
    }
    setCreating(null)
    setDraftName('')
  }, [draftName, creating, createFolder, createTag])

  const handleCreateNote = useCallback(() => {
    createNote.mutate({})
  }, [createNote])

  return (
    <Stack gap={2} h="100%" p="xs">
      <Button
        leftSection={<IconPlus size={16} />}
        loading={createNote.isPending}
        onClick={handleCreateNote}
      >
        New note
      </Button>

      <Text c="dimmed" fw={700} mt="md" px="xs" size="xs" tt="uppercase">Library</Text>
      <NavLink
        active={scope.kind === 'all'} label="All notes"
        leftSection={<IconNote size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.all ?? 0}</Text>}
        onClick={() => pick({ kind: 'all', label: 'All notes' })}
      />
      <NavLink
        active={scope.kind === 'starred'} label="Starred"
        leftSection={<IconStar size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.starred ?? 0}</Text>}
        onClick={() => pick({ kind: 'starred', label: 'Starred' })}
      />

      <Group justify="space-between" mt="md" px="xs">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">Folders</Text>
        <ActionIcon aria-label="New folder" size="sm" variant="subtle"
          onClick={() => { setCreating('folder'); setDraftName('') }}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {creating === 'folder' && (
        <TextInput
          autoFocus placeholder="Folder name" size="xs" value={draftName}
          onBlur={commitInline}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      {folders.map((f) => (
        <NavLink
          key={f.uuid} active={scope.kind === 'folder' && scope.uuid === f.uuid} label={f.name}
          leftSection={<IconFolder size={16} />}
          rightSection={
            <Group gap={4} wrap="nowrap">
              <Text c="dimmed" size="xs">{counts?.folders[f.uuid] ?? 0}</Text>
              <Menu withinPortal position="bottom-end">
                <Menu.Target>
                  <ActionIcon aria-label="Folder actions" size="sm" variant="subtle"
                    onClick={(e) => e.stopPropagation()}>
                    <IconDots size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => {
                    const name = window.prompt('Rename folder', f.name)
                    if (name) renameFolder.mutate({ uuid: f.uuid, name })
                  }}>Rename</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={() => deleteFolder.mutate(f.uuid)}>
                    Delete folder
                  </Menu.Item>
                  <Text c="dimmed" pb="xs" px="sm" size="xs">
                    Notes inside move to All notes — nothing is deleted.
                  </Text>
                </Menu.Dropdown>
              </Menu>
            </Group>
          }
          onClick={() => pick({ kind: 'folder', uuid: f.uuid, label: f.name })}
        />
      ))}

      <Group justify="space-between" mt="md" px="xs">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">Tags</Text>
        <ActionIcon aria-label="New tag" size="sm" variant="subtle"
          onClick={() => { setCreating('tag'); setDraftName('') }}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {creating === 'tag' && (
        <TextInput
          autoFocus placeholder="Tag name" size="xs" value={draftName}
          onBlur={commitInline}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      <Group gap={5} px="xs" wrap="wrap">
        {tags.map((t) => (
          <Menu key={t.uuid} withinPortal position="bottom-start" trigger="click">
            <Menu.Target>
              <Badge
                style={{ cursor: 'pointer' }} variant="light"
                onClick={() => pick({ kind: 'tag', slug: t.slug, label: `#${t.name}` })}
                onContextMenu={(e) => e.preventDefault()}
              >
                #{t.name} {counts?.tags[t.slug] ?? 0}
              </Badge>
            </Menu.Target>
            <Menu.Dropdown>
              {/* Tag menu is exactly two items. */}
              <Menu.Item>Rename</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={() => deleteTag.mutate(t.uuid)}>Delete tag</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ))}
      </Group>

      <NavLink
        active={scope.kind === 'trash'} label="Trash" leftSection={<IconTrash size={16} />}
        mt="auto"
        rightSection={<Text c="dimmed" size="xs">{counts?.trashed ?? 0}</Text>}
        onClick={() => pick({ kind: 'trash', label: 'Trash' })}
      />
    </Stack>
  )
})
