import { memo, useCallback, useState } from 'react'

import {
  ActionIcon,
  Badge,
  Group,
  Menu,
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
  IconTag,
  IconTrash,
} from '@tabler/icons-react'

import { ALL_NOTES_LABEL, STARRED_LABEL, TRASH_LABEL } from '@src/constants/labels'
import { MAX_FOLDER_NAME_LENGTH, MAX_TAG_NAME_LENGTH } from '@src/constants/limits'
import { type Scope, useUiStore } from '@src/stores/ui_store'
import type { Counts, Folder, Tag } from '@src/types/api'
import { stopEventPropagation } from '@src/utils/events'

import { RenameItemModal } from './rename_item_modal'

interface ISidebarNavProps {
  folders:         Folder[]
  tags:            Tag[]
  counts?:         Counts
  onCreateFolder?: (name: string) => void
  onRenameFolder?: (uuid: string, name: string) => void
  onDeleteFolder?: (uuid: string) => void
  onCreateTag?:    (name: string) => void
  onRenameTag?:    (uuid: string, name: string) => void
  onDeleteTag?:    (uuid: string) => void
}

export const SidebarNav: React.NamedExoticComponent<ISidebarNavProps> = memo(function SidebarNav({
  folders,
  tags,
  counts,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
}: ISidebarNavProps): React.JSX.Element {
  const { scope, setScope, setView } = useUiStore()

  const [creating, setCreating] = useState<'folder' | 'tag' | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null)
  const [renameTagTarget, setRenameTagTarget] = useState<Tag | null>(null)

  const pick: (next: Scope) => void = useCallback(
    (next: Scope) => {
      setScope(next)
      setView('list')
    },
    [setScope, setView],
  )

  const commitInline: () => void = useCallback(() => {
    const name: string = draftName.trim()
    if (name) {
      if (creating === 'folder') {
        onCreateFolder?.(name)
      } else {
        onCreateTag?.(name)
      }
    }
    setCreating(null)
    setDraftName('')
  }, [draftName, creating, onCreateFolder, onCreateTag])

  const isScopeActive: (kind: string, uuidOrSlug?: string) => boolean = (kind: string, uuidOrSlug?: string): boolean => {
    if (scope.kind !== kind) return false
    if (kind === 'folder') return (scope as { uuid?: string }).uuid === uuidOrSlug
    if (kind === 'tag') return (scope as { slug?: string }).slug === uuidOrSlug
    return true
  }

  return (
    <Stack gap={2} mb="md">
      <NavLink
        active={isScopeActive('all')}
        label={ALL_NOTES_LABEL}
        leftSection={<IconNote size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.all ?? 0}</Text>}
        onClick={() => pick({ kind: 'all', label: ALL_NOTES_LABEL })}
      />

      <NavLink
        active={isScopeActive('starred')}
        label={STARRED_LABEL}
        leftSection={<IconStar size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.starred ?? 0}</Text>}
        onClick={() => pick({ kind: 'starred', label: STARRED_LABEL })}
      />

      {/* Folders heading */}
      <Group justify="space-between" mt="xs" px="xs">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Folders
        </Text>
        <ActionIcon
          aria-label="New folder"
          size="xs"
          variant="subtle"
          onClick={() => {
            setCreating('folder')
            setDraftName('')
          }}
        >
          <IconPlus size={12} />
        </ActionIcon>
      </Group>

      {creating === 'folder' && (
        <TextInput
          autoFocus
          maxLength={MAX_FOLDER_NAME_LENGTH}
          placeholder="Folder name"
          px="xs"
          size="xs"
          value={draftName}
          onBlur={commitInline}
          onChange={(e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => setDraftName(e.currentTarget.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      {folders.map((f: Folder) => (
        <NavLink
          key={f.uuid}
          active={isScopeActive('folder', f.uuid)}
          label={f.name}
          leftSection={<IconFolder color={f.color ?? undefined} size={16} />}
          rightSection={
            <Group gap={2} wrap="nowrap">
              <Text c="dimmed" size="xs">{counts?.folders?.[f.uuid] ?? 0}</Text>
              <Menu withinPortal position="right-start" shadow="md">
                <Menu.Target>
                  <ActionIcon
                    aria-label="Folder actions"
                    size="xs"
                    variant="subtle"
                    onClick={stopEventPropagation}
                  >
                    <IconDots size={12} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown onClick={stopEventPropagation}>
                  <Menu.Item onClick={() => setRenameFolderTarget(f)}>
                    Rename folder
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    onClick={() => onDeleteFolder?.(f.uuid)}
                  >
                    Delete folder
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          }
          onClick={() => pick({ kind: 'folder', uuid: f.uuid, label: f.name })}
        />
      ))}

      {/* Tags heading */}
      <Group justify="space-between" mt="xs" px="xs">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Tags
        </Text>
        <ActionIcon
          aria-label="New tag"
          size="xs"
          variant="subtle"
          onClick={() => {
            setCreating('tag')
            setDraftName('')
          }}
        >
          <IconPlus size={12} />
        </ActionIcon>
      </Group>

      {creating === 'tag' && (
        <TextInput
          autoFocus
          maxLength={MAX_TAG_NAME_LENGTH}
          placeholder="Tag name"
          px="xs"
          size="xs"
          value={draftName}
          onBlur={commitInline}
          onChange={(e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => setDraftName(e.currentTarget.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') setCreating(null)
          }}
        />
      )}

      <Group gap={4} px="xs" py={2}>
        {tags.map((t: Tag) => (
          <Group key={t.uuid} gap={2} wrap="nowrap">
            <UnstyledButton
              onClick={() => pick({ kind: 'tag', slug: t.slug, label: `#${t.name}` })}
            >
              <Badge
                leftSection={<IconTag size={10} />}
                size="sm"
                variant={isScopeActive('tag', t.slug) ? 'filled' : 'light'}
              >
                {t.name}
              </Badge>
            </UnstyledButton>
            <Menu withinPortal position="right-start" shadow="md">
              <Menu.Target>
                <ActionIcon
                  aria-label="Tag actions"
                  size="xs"
                  variant="subtle"
                  onClick={stopEventPropagation}
                >
                  <IconDots size={10} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={stopEventPropagation}>
                <Menu.Item onClick={() => setRenameTagTarget(t)}>
                  Rename tag
                </Menu.Item>
                <Menu.Item color="red" onClick={() => onDeleteTag?.(t.uuid)}>
                  Delete tag
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ))}
      </Group>

      <NavLink
        active={isScopeActive('trash')}
        label={TRASH_LABEL}
        leftSection={<IconTrash size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.trashed ?? 0}</Text>}
        onClick={() => pick({ kind: 'trash', label: TRASH_LABEL })}
      />

      <RenameItemModal
        initialValue={renameFolderTarget?.name ?? ''}
        label="Folder name"
        maxLength={MAX_FOLDER_NAME_LENGTH}
        opened={Boolean(renameFolderTarget)}
        title="Rename folder"
        onClose={() => setRenameFolderTarget(null)}
        onConfirm={(name: string) => {
          if (renameFolderTarget) {
            onRenameFolder?.(renameFolderTarget.uuid, name)
          }
        }}
      />

      <RenameItemModal
        initialValue={renameTagTarget?.name ?? ''}
        label="Tag name"
        maxLength={MAX_TAG_NAME_LENGTH}
        opened={Boolean(renameTagTarget)}
        title="Rename tag"
        onClose={() => setRenameTagTarget(null)}
        onConfirm={(name: string) => {
          if (renameTagTarget) {
            onRenameTag?.(renameTagTarget.uuid, name)
          }
        }}
      />
    </Stack>
  )
})
