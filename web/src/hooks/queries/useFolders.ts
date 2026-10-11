import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import * as foldersApi from '@/api/folders'
import { BOOTSTRAP_KEY } from './useBootstrap'
import { NOTES_KEY } from './useNotes'

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: foldersApi.createFolder,
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useRenameFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      foldersApi.renameFolder(uuid, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: foldersApi.deleteFolder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      // Destructive actions must say what SURVIVES, not just what went.
      notifications.show({
        message: 'Folder deleted. Its notes moved to All notes — nothing was deleted.',
      })
    },
  })
}
