import { memo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  NavLink,
  Paper,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import {
  IconCloud,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDots,
  IconFolder,
  IconNote,
  IconPlus,
  IconStar,
  IconTag,
  IconTrash,
} from '@tabler/icons-react'

import { RenameItemModal } from '@/components/common/RenameItemModal'
import { ALL_NOTES_LABEL, STARRED_LABEL, TRASH_LABEL } from '@/constants/labels'
import { MAX_FOLDER_NAME_LENGTH, MAX_TAG_NAME_LENGTH } from '@/constants/limits'
import { stopEventPropagation } from '@/lib/events'
import { deviceKind } from '@/platform/deviceKind'
import { useUiStore, type Scope } from '@/stores/uiStore'
import type { Container, Counts, Folder, Tag } from '@/types/api'

interface ContainerSectionProps {
  container: Container
  title: string
  folders: Folder[]
  tags: Tag[]
  counts?: Counts
  signedIn?: boolean
  onCreateFolder?: (name: string, container: Container) => void
  onRenameFolder?: (uuid: string, name: string) => void
  onDeleteFolder?: (uuid: string) => void
  onCreateTag?: (name: string, container: Container) => void
  onRenameTag?: (uuid: string, name: string) => void
  onDeleteTag?: (uuid: string) => void
}

export const ContainerSection = memo(function ContainerSection({
  container,
  title,
  folders,
  tags,
  counts,
  signedIn = true,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
}: ContainerSectionProps) {
  const navigate = useNavigate()
  const { scope, setScope, setView } = useUiStore()
  const dev = deviceKind()

  const [creating, setCreating] = useState<'folder' | 'tag' | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null)
  const [renameTagTarget, setRenameTagTarget] = useState<Tag | null>(null)

  const pick = useCallback(
    (next: Scope) => {
      setScope({ ...next, container })
      setView('list')
    },
    [setScope, setView, container],
  )

  const commitInline = useCallback(() => {
    const name = draftName.trim()
    if (name) {
      if (creating === 'folder') {
        onCreateFolder?.(name, container)
      } else {
        onCreateTag?.(name, container)
      }
    }
    setCreating(null)
    setDraftName('')
  }, [draftName, creating, onCreateFolder, onCreateTag, container])

  const renderDeviceIcon = () => {
    if (container === 'cloud') {
      return <IconCloud size={16} />
    }
    if (dev.icon === 'phone') {
      return <IconDeviceMobile size={16} />
    }
    if (dev.icon === 'tablet') {
      return <IconDeviceTablet size={16} />
    }
    return <IconDeviceLaptop size={16} />
  }

  const isScopeActive = (kind: string, uuidOrSlug?: string) => {
    if (scope.container !== container) return false
    if (scope.kind !== kind) return false
    if (kind === 'folder') return (scope as { uuid?: string }).uuid === uuidOrSlug
    if (kind === 'tag') return (scope as { slug?: string }).slug === uuidOrSlug
    return true
  }

  return (
    <Stack gap={2} mb="md">
      <Group justify="space-between" px="xs" py={4}>
        <Group gap={6}>
          {renderDeviceIcon()}
          <Text fw={700} size="xs" tt="uppercase">
            {title}
          </Text>
        </Group>
        {container === 'cloud' && !signedIn && (
          <Badge color="gray" size="xs" variant="light">
            Not signed in
          </Badge>
        )}
      </Group>

      {container === 'cloud' && !signedIn && (
        <Paper withBorder mb="xs" mt={4} p="xs" radius="sm">
          <Text fw={600} size="xs">
            Cloud Sync
          </Text>
          <Text c="dimmed" mt={2} size="xs">
            Sign in to access, create, and sync Cloud notes across devices.
          </Text>
          <Button
            fullWidth
            mt="xs"
            size="xs"
            variant="light"
            onClick={() => navigate('/login')}
          >
            Sign in to enable Cloud
          </Button>
        </Paper>
      )}

      {container === 'cloud' && !signedIn ? null : (
        <>
          {container === 'local' && (
            <Text c="dimmed" mb={4} px="xs" size="xs">
              Not backed up · stays on {dev.noun}
            </Text>
          )}

          <NavLink
            active={isScopeActive('all')}
            label={ALL_NOTES_LABEL}
            leftSection={<IconNote size={16} />}
            rightSection={<Text c="dimmed" size="xs">{counts?.all ?? 0}</Text>}
            onClick={() => pick({ kind: 'all', container, label: ALL_NOTES_LABEL })}
          />

          {container === 'cloud' && (
            <NavLink
              active={isScopeActive('starred')}
              label={STARRED_LABEL}
              leftSection={<IconStar size={16} />}
              rightSection={<Text c="dimmed" size="xs">{counts?.starred ?? 0}</Text>}
              onClick={() => pick({ kind: 'starred', container, label: STARRED_LABEL })}
            />
          )}

          {/* Folders heading */}
          <Group justify="space-between" mt="xs" px="xs">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Folders
            </Text>
            <ActionIcon
              aria-label={`New ${title} folder`}
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
              onClick={() => pick({ kind: 'folder', container, uuid: f.uuid, label: f.name })}
            />
          ))}

          {/* Tags heading */}
          <Group justify="space-between" mt="xs" px="xs">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Tags
            </Text>
            <ActionIcon
              aria-label={`New ${title} tag`}
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
              onChange={(e) => setDraftName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitInline()
                if (e.key === 'Escape') setCreating(null)
              }}
            />
          )}

          <Group gap={4} px="xs" py={2}>
            {tags.map((t) => (
              <Group key={t.uuid} gap={2} wrap="nowrap">
                <UnstyledButton
                  onClick={() => pick({ kind: 'tag', container, slug: t.slug, label: `#${t.name}` })}
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
            onClick={() => pick({ kind: 'trash', container, label: TRASH_LABEL })}
          />

          <RenameItemModal
            initialValue={renameFolderTarget?.name ?? ''}
            label="Folder name"
            maxLength={MAX_FOLDER_NAME_LENGTH}
            opened={Boolean(renameFolderTarget)}
            title="Rename folder"
            onClose={() => setRenameFolderTarget(null)}
            onConfirm={(name) => {
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
            onConfirm={(name) => {
              if (renameTagTarget) {
                onRenameTag?.(renameTagTarget.uuid, name)
              }
            }}
          />
        </>
      )}
    </Stack>
  )
})
