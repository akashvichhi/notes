import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import * as tagsApi from '@/api/tags'

import { BOOTSTRAP_KEY } from './useBootstrap'
import { NOTES_KEY } from './useNotes'

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tagsApi.createTag,
    onSuccess:  () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useRenameTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      tagsApi.renameTag(uuid, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tagsApi.deleteTag,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      notifications.show({
        message: 'Tag deleted. It was removed from your notes — the notes stay.',
      })
    },
  })
}
