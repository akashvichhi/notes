import { memo, useCallback, useState } from 'react'

import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  NavLink,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import {
  IconDots,
  IconFolder,
  IconNote,
  IconPlus,
  IconStar,
  IconTrash,
} from '@tabler/icons-react'

import {
  ALL_NOTES_LABEL,
  DEFAULT_NOTE_TITLE,
  STARRED_LABEL,
  TRASH_LABEL,
} from '@/constants/labels'
import { useBootstrap } from '@/hooks/queries/useBootstrap'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@/hooks/queries/useFolders'
import { useCreateNote } from '@/hooks/queries/useNotes'
import { useCreateTag, useDeleteTag, useRenameTag } from '@/hooks/queries/useTags'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useUiStore } from '@/stores/uiStore'
import type { Folder, Tag } from '@/types/api'

export const Sidebar = memo(function Sidebar() {
  const { folders, tags, counts } = useBootstrap()
  const { scope, setScope, setView } = useUiStore()
  const isPhone = useIsPhone()

  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const createTag = useCreateTag()
  const renameTag = useRenameTag()
  const deleteTag = useDeleteTag()
  const createNote = useCreateNote()

  // Inline create, not a modal: naming a folder is one field.
  const [creating, setCreating] = useState<'folder' | 'tag' | null>(null)
  const [draftName, setDraftName] = useState('')

  // Rename modals for Folder and Tag
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')

  const [renameTagTarget, setRenameTagTarget] = useState<Tag | null>(null)
  const [renameTagName, setRenameTagName] = useState('')

  const pick = useCallback(
    (next: Parameters<typeof setScope>[0]) => {
      setScope(next)
      if (isPhone) setView('list')
    },
    [setScope, isPhone, setView],
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
    createNote.mutate(scope.kind === 'folder' ? { folder_id: scope.uuid } : {})
  }, [createNote, scope])

  const handleOpenRenameFolder = useCallback((folder: Folder) => {
    setRenameFolderTarget(folder)
    setRenameFolderName(folder.name)
  }, [])

  const handleCloseRenameFolder = useCallback(() => {
    setRenameFolderTarget(null)
    setRenameFolderName('')
  }, [])

  const handleConfirmRenameFolder = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!renameFolderTarget) return
      const name = renameFolderName.trim()
      if (name && name !== renameFolderTarget.name) {
        renameFolder.mutate({ uuid: renameFolderTarget.uuid, name })
      }
      handleCloseRenameFolder()
    },
    [renameFolderTarget, renameFolderName, renameFolder, handleCloseRenameFolder],
  )

  const handleOpenRenameTag = useCallback((tag: Tag) => {
    setRenameTagTarget(tag)
    setRenameTagName(tag.name)
  }, [])

  const handleCloseRenameTag = useCallback(() => {
    setRenameTagTarget(null)
    setRenameTagName('')
  }, [])

  const handleConfirmRenameTag = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!renameTagTarget) return
      const name = renameTagName.trim()
      if (name && name !== renameTagTarget.name) {
        renameTag.mutate({ uuid: renameTagTarget.uuid, name })
      }
      handleCloseRenameTag()
    },
    [renameTagTarget, renameTagName, renameTag, handleCloseRenameTag],
  )

  return (
    <>
      <Stack gap={2} h="100%" p="xs">
        <Button
          leftSection={<IconPlus size={16} />}
          loading={createNote.isPending}
          onClick={handleCreateNote}
        >
          {DEFAULT_NOTE_TITLE}
        </Button>

        <Text c="dimmed" fw={700} mt="md" px="xs" size="xs" tt="uppercase">
          Library
        </Text>
        <NavLink
          active={scope.kind === 'all'}
          label={ALL_NOTES_LABEL}
          leftSection={<IconNote size={16} />}
          rightSection={<Text c="dimmed" size="xs">{counts?.all ?? 0}</Text>}
          onClick={() => pick({ kind: 'all', label: ALL_NOTES_LABEL })}
        />
        <NavLink
          active={scope.kind === 'starred'}
          label={STARRED_LABEL}
          leftSection={<IconStar size={16} />}
          rightSection={<Text c="dimmed" size="xs">{counts?.starred ?? 0}</Text>}
          onClick={() => pick({ kind: 'starred', label: STARRED_LABEL })}
        />

        <Group justify="space-between" mt="md" px="xs">
          <Text c="dimmed" fw={700} size="xs" tt="uppercase">
            Folders
          </Text>
          <ActionIcon
            aria-label="New folder"
            size="sm"
            variant="subtle"
            onClick={() => {
              setCreating('folder')
              setDraftName('')
            }}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>

        {creating === 'folder' && (
          <TextInput
            autoFocus
            placeholder="Folder name"
            size="xs"
            value={draftName}
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
            key={f.uuid}
            active={scope.kind === 'folder' && scope.uuid === f.uuid}
            label={f.name}
            leftSection={<IconFolder size={16} />}
            rightSection={
              <Group
                data-folder-actions="true"
                gap={4}
                wrap="nowrap"
                onClick={(e) => {
                  e.stopPropagation()
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Text c="dimmed" size="xs">
                  {counts?.folders[f.uuid] ?? 0}
                </Text>
                <Menu withinPortal position="bottom-end">
                  <Menu.Target>
                    <ActionIcon
                      aria-label="Folder actions"
                      size="sm"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <IconDots size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => handleOpenRenameFolder(f)}>
                      Rename folder
                    </Menu.Item>
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
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-folder-actions]')) return
              pick({ kind: 'folder', uuid: f.uuid, label: f.name })
            }}
          />
        ))}

        <Group justify="space-between" mt="md" px="xs">
          <Text c="dimmed" fw={700} size="xs" tt="uppercase">
            Tags
          </Text>
          <ActionIcon
            aria-label="New tag"
            size="sm"
            variant="subtle"
            onClick={() => {
              setCreating('tag')
              setDraftName('')
            }}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>

        {creating === 'tag' && (
          <TextInput
            autoFocus
            placeholder="Tag name"
            size="xs"
            value={draftName}
            onBlur={commitInline}
            onChange={(e) => setDraftName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitInline()
              if (e.key === 'Escape') setCreating(null)
            }}
          />
        )}

        <Group gap={6} px="xs" wrap="wrap">
          {tags.map((t) => (
            <Group
              key={t.uuid}
              gap={2}
              style={{
                borderRadius: 'var(--mantine-radius-xl)',
                background:   scope.kind === 'tag' && scope.slug === t.slug
                  ? 'var(--mantine-color-blue-light)'
                  : 'var(--mantine-color-default-hover)',
                padding: '2px 4px 2px 8px',
                border:  '1px solid var(--mantine-color-default-border)',
              }}
              wrap="nowrap"
            >
              <UnstyledButton
                onClick={() => pick({ kind: 'tag', slug: t.slug, label: `#${t.name}` })}
              >
                <Text fw={500} size="xs" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  #{t.name}{' '}
                  <Text span c="dimmed" size="xs">
                    {counts?.tags[t.slug] ?? 0}
                  </Text>
                </Text>
              </UnstyledButton>

              <Menu withinPortal position="bottom-start" shadow="md">
                <Menu.Target>
                  <ActionIcon
                    aria-label={`Tag ${t.name} actions`}
                    color="gray"
                    size="xs"
                    variant="subtle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconDots size={12} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => handleOpenRenameTag(t)}>
                    Rename tag
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={() => deleteTag.mutate(t.uuid)}>
                    Delete tag
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ))}
        </Group>

        <NavLink
          active={scope.kind === 'trash'}
          label={TRASH_LABEL}
          leftSection={<IconTrash size={16} />}
          mt="auto"
          rightSection={<Text c="dimmed" size="xs">{counts?.trashed ?? 0}</Text>}
          onClick={() => pick({ kind: 'trash', label: TRASH_LABEL })}
        />
      </Stack>

      <Modal
        centered
        opened={Boolean(renameFolderTarget)}
        size="sm"
        title="Rename folder"
        onClose={handleCloseRenameFolder}
      >
        <form onSubmit={handleConfirmRenameFolder}>
          <Stack gap="sm">
            <TextInput
              autoFocus
              data-autofocus
              label="Folder name"
              placeholder="Folder name"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={handleCloseRenameFolder}>
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        centered
        opened={Boolean(renameTagTarget)}
        size="sm"
        title="Rename tag"
        onClose={handleCloseRenameTag}
      >
        <form onSubmit={handleConfirmRenameTag}>
          <Stack gap="sm">
            <TextInput
              autoFocus
              data-autofocus
              label="Tag name"
              placeholder="Tag name"
              value={renameTagName}
              onChange={(e) => setRenameTagName(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={handleCloseRenameTag}>
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  )
})
