import { memo, useCallback, useState } from 'react'
import { Link } from 'react-router'

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
import { type IScopeState, useScope } from '@src/pages/notes/hooks/use_scope'
import { ALL_SCOPE, scopePath } from '@src/routes/scope_location'
import { type IUiState, type TView, useUiStore } from '@src/stores/ui_store'
import type { INoteCounts, IFolder, ITag } from '@src/types/api'
import type { TScope } from '@src/types/scope'
import { stopEventPropagation } from '@src/utils/events'

import { RenameItemModal } from './rename_item_modal'

interface ISidebarNavProps {
  folders:         IFolder[]
  tags:            ITag[]
  counts?:         INoteCounts
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
  const { scope }: IScopeState = useScope()
  const setView: (view: TView) => void = useUiStore((s: IUiState) => s.setView)

  const [creating, setCreating] = useState<'folder' | 'tag' | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameFolderTarget, setRenameFolderTarget] = useState<IFolder | null>(null)
  const [renameTagTarget, setRenameTagTarget] = useState<ITag | null>(null)

  // The links change the URL; on a phone, choosing a list also shows it.
  const showList: () => void = useCallback((): void => {
    setView('list')
  }, [setView])

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

  // Two lists are the same list exactly when they have the same URL.
  const isScopeActive: (candidate: TScope) => boolean = (candidate: TScope): boolean => scopePath(candidate) === scopePath(scope)

  return (
    <Stack gap={2} mb="md">
      <NavLink
        active={isScopeActive(ALL_SCOPE)}
        component={Link}
        label={ALL_NOTES_LABEL}
        leftSection={<IconNote size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.all ?? 0}</Text>}
        to={scopePath(ALL_SCOPE)}
        onClick={showList}
      />

      <NavLink
        active={isScopeActive({ kind: 'starred' })}
        component={Link}
        label={STARRED_LABEL}
        leftSection={<IconStar size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.starred ?? 0}</Text>}
        to={scopePath({ kind: 'starred' })}
        onClick={showList}
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

      {folders.map((f: IFolder) => (
        <NavLink
          key={f.uuid}
          active={isScopeActive({ kind: 'folder', uuid: f.uuid })}
          component={Link}
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
          to={scopePath({ kind: 'folder', uuid: f.uuid })}
          onClick={showList}
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
        {tags.map((t: ITag) => (
          <Group key={t.uuid} gap={2} wrap="nowrap">
            <UnstyledButton component={Link} to={scopePath({ kind: 'tag', slug: t.slug })} onClick={showList}>
              <Badge
                leftSection={<IconTag size={10} />}
                size="sm"
                variant={isScopeActive({ kind: 'tag', slug: t.slug }) ? 'filled' : 'light'}
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
        active={isScopeActive({ kind: 'trash' })}
        component={Link}
        label={TRASH_LABEL}
        leftSection={<IconTrash size={16} />}
        rightSection={<Text c="dimmed" size="xs">{counts?.trashed ?? 0}</Text>}
        to={scopePath({ kind: 'trash' })}
        onClick={showList}
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
