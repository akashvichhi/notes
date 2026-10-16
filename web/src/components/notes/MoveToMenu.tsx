import { memo, useCallback } from 'react'

import { Menu } from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconFolder, IconFolderShare } from '@tabler/icons-react'

import type { Container, Folder, UUID } from '@/types/api'

interface MoveToMenuProps {
  note: { uuid: UUID; container?: Container; folder_id?: UUID | null }
  folders: (Folder & { container?: Container })[]
  onMove: (target: { folder_id: UUID | null; container?: Container }) => void
  onMoveConfirmed?: (target: { folder_id: UUID | null; container?: Container }) => void
}

export const MoveToMenu = memo(function MoveToMenu({
  note,
  folders,
  onMove,
  onMoveConfirmed,
}: MoveToMenuProps) {
  const currentContainer: Container = note.container ?? 'cloud'

  const handleSelect = useCallback(
    (targetFolder: (Folder & { container?: Container }) | null, targetContainer: Container) => {
      const folder_id = targetFolder ? targetFolder.uuid : null

      if (targetContainer !== currentContainer) {
        const isMovingToLocal = targetContainer === 'local'
        modals.openConfirmModal({
          title:    isMovingToLocal ? 'Move to On This Device' : 'Move to Cloud',
          children: isMovingToLocal
            ? 'This note will stop syncing and will disappear from your other devices.'
            : 'This note will be uploaded to your account and appear on your other devices.',
          labels:       { confirm: 'Move note', cancel: 'Cancel' },
          confirmProps: { color: isMovingToLocal ? 'orange' : 'blue' },
          onConfirm:    () => {
            onMove({ folder_id, container: targetContainer })
            onMoveConfirmed?.({ folder_id, container: targetContainer })
          },
        })
        return
      }

      onMove({ folder_id, container: targetContainer })
      onMoveConfirmed?.({ folder_id, container: targetContainer })
    },
    [currentContainer, onMove, onMoveConfirmed],
  )

  const cloudFolders = folders.filter((f) => (f.container ?? 'cloud') === 'cloud')
  const localFolders = folders.filter((f) => f.container === 'local')

  return (
    <Menu.Dropdown>
      <Menu.Label>Cloud Folders</Menu.Label>
      <Menu.Item
        leftSection={<IconFolderShare size={14} />}
        onClick={() => handleSelect(null, 'cloud')}
      >
        All notes (No folder)
      </Menu.Item>
      {cloudFolders.map((f) => (
        <Menu.Item
          key={f.uuid}
          leftSection={<IconFolder color={f.color ?? undefined} size={14} />}
          onClick={() => handleSelect(f, 'cloud')}
        >
          {f.name}
        </Menu.Item>
      ))}

      {localFolders.length > 0 && (
        <>
          <Menu.Divider />
          <Menu.Label>On This Device Folders</Menu.Label>
          <Menu.Item
            leftSection={<IconFolderShare size={14} />}
            onClick={() => handleSelect(null, 'local')}
          >
            All notes (On This Device)
          </Menu.Item>
          {localFolders.map((f) => (
            <Menu.Item
              key={f.uuid}
              leftSection={<IconFolder color={f.color ?? undefined} size={14} />}
              onClick={() => handleSelect(f, 'local')}
            >
              {f.name}
            </Menu.Item>
          ))}
        </>
      )}
    </Menu.Dropdown>
  )
})
