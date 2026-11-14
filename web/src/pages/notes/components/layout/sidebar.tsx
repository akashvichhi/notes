import { memo, useCallback } from 'react'

import { ScrollArea, Stack } from '@mantine/core'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { useBootstrap } from '@src/queries/bootstrap_queries'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@src/queries/folders_queries'
import type { TDeleteFolderMutation, TRenameFolderMutation } from '@src/queries/folders_queries'
import { useCreateTag, useDeleteTag, useRenameTag } from '@src/queries/tags_queries'
import type { TDeleteTagMutation, TRenameTagMutation } from '@src/queries/tags_queries'
import type { IBootstrap, IFolder, ITag, TUuid } from '@src/types/api'

import { SidebarNav } from './sidebar_nav'



export const Sidebar: React.MemoExoticComponent<() => React.JSX.Element> = memo(function Sidebar() {
  const { folders, tags, counts } = useBootstrap()

  const createFolder: UseMutationResult<IFolder, IApiError, { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid; }, { previous: IBootstrap | undefined; tempUuid: string; }> = useCreateFolder()
  const renameFolder: TRenameFolderMutation = useRenameFolder()
  const deleteFolder: TDeleteFolderMutation = useDeleteFolder()
  const createTag: UseMutationResult<ITag, IApiError, { name: string; uuid?: TUuid; }, { previous: IBootstrap | undefined; tempUuid: string; }> = useCreateTag()
  const renameTag: TRenameTagMutation = useRenameTag()
  const deleteTag: TDeleteTagMutation = useDeleteTag()

  const handleCreateFolder: (name: string) => void = useCallback((name: string): void => {
    createFolder.mutate({ name })
  }, [createFolder])

  const handleCreateTag: (name: string) => void = useCallback((name: string): void => {
    createTag.mutate({ name })
  }, [createTag])

  return (
    <ScrollArea h="100%">
      <Stack gap="xs" p="xs">
        <SidebarNav
          counts={counts ?? undefined}
          folders={folders}
          tags={tags}
          onCreateFolder={handleCreateFolder}
          onCreateTag={handleCreateTag}
          onDeleteFolder={(uuid: string) => deleteFolder.mutate(uuid)}
          onDeleteTag={(uuid: string) => deleteTag.mutate(uuid)}
          onRenameFolder={(uuid: string, name: string) => renameFolder.mutate({ uuid, name })}
          onRenameTag={(uuid: string, name: string) => renameTag.mutate({ uuid, name })}
        />
      </Stack>
    </ScrollArea>
  )
})
