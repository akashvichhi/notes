import { ActionIcon, Badge, Button, Group, Menu, NavLink, Stack, Text, TextInput } from '@mantine/core'
import {
  IconDots, IconFolder, IconNote, IconPlus, IconStar, IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'

import { useBootstrap } from '@/hooks/queries/useBootstrap'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@/hooks/queries/useFolders'
import { useCreateTag, useDeleteTag } from '@/hooks/queries/useTags'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useUiStore } from '@/stores/uiStore'
import { useIsPhone } from '@/hooks/useIsPhone'

export function Sidebar() {
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

  function pick(next: Parameters<typeof setScope>[0]) {
    setScope(next)
    closeNav()
    if (isPhone) setView('list')
  }

  function commitInline() {
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
  }

  return (
    <Stack p="xs" gap={2} h="100%">
      <Button
        leftSection={<IconPlus size={16} />}
        loading={createNote.isPending}
        onClick={() => createNote.mutate({})}
      >
        New note
      </Button>

      <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="md" px="xs">Library</Text>
      <NavLink
        label="All notes" leftSection={<IconNote size={16} />}
        rightSection={<Text size="xs" c="dimmed">{counts?.all ?? 0}</Text>}
        active={scope.kind === 'all'}
        onClick={() => pick({ kind: 'all', label: 'All notes' })}
      />
      <NavLink
        label="Starred" leftSection={<IconStar size={16} />}
        rightSection={<Text size="xs" c="dimmed">{counts?.starred ?? 0}</Text>}
        active={scope.kind === 'starred'}
        onClick={() => pick({ kind: 'starred', label: 'Starred' })}
      />

      <Group justify="space-between" mt="md" px="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Folders</Text>
        <ActionIcon size="sm" variant="subtle" aria-label="New folder"
          onClick={() => { setCreating('folder'); setDraftName('') }}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {creating === 'folder' && (
        <TextInput
          autoFocus size="xs" placeholder="Folder name" value={draftName}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onBlur={commitInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      {folders.map((f) => (
        <NavLink
          key={f.uuid} label={f.name} leftSection={<IconFolder size={16} />}
          active={scope.kind === 'folder' && scope.uuid === f.uuid}
          onClick={() => pick({ kind: 'folder', uuid: f.uuid, label: f.name })}
          rightSection={
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">{counts?.folders[f.uuid] ?? 0}</Text>
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon size="sm" variant="subtle" aria-label="Folder actions"
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
                  <Text size="xs" c="dimmed" px="sm" pb="xs">
                    Notes inside move to All notes — nothing is deleted.
                  </Text>
                </Menu.Dropdown>
              </Menu>
            </Group>
          }
        />
      ))}

      <Group justify="space-between" mt="md" px="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Tags</Text>
        <ActionIcon size="sm" variant="subtle" aria-label="New tag"
          onClick={() => { setCreating('tag'); setDraftName('') }}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {creating === 'tag' && (
        <TextInput
          autoFocus size="xs" placeholder="Tag name" value={draftName}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onBlur={commitInline}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      <Group gap={5} px="xs" wrap="wrap">
        {tags.map((t) => (
          <Menu key={t.uuid} position="bottom-start" withinPortal trigger="click">
            <Menu.Target>
              <Badge
                variant="light" style={{ cursor: 'pointer' }}
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
        mt="auto" label="Trash" leftSection={<IconTrash size={16} />}
        rightSection={<Text size="xs" c="dimmed">{counts?.trashed ?? 0}</Text>}
        active={scope.kind === 'trash'}
        onClick={() => pick({ kind: 'trash', label: 'Trash' })}
      />
    </Stack>
  )
}
