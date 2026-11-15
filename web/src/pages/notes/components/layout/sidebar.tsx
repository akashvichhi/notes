import { memo, useCallback } from 'react'

import { ScrollArea, Stack } from '@mantine/core'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { type ISidebarActions, useSidebarActions } from '@src/pages/notes/hooks/use_sidebar_actions'
import { useBootstrap } from '@src/queries/bootstrap_queries'
import { useCreateFolder } from '@src/queries/folders_queries'
import { useCreateTag } from '@src/queries/tags_queries'
import type { IBootstrap, IFolder, ITag, TUuid } from '@src/types/api'

import { SidebarNav } from './sidebar_nav'



export const Sidebar: React.MemoExoticComponent<() => React.JSX.Element> = memo(function Sidebar() {
  const { folders, tags, counts } = useBootstrap()

  const createFolder: UseMutationResult<IFolder, IApiError, { name: string; parentUuid?: TUuid; color?: string; uuid?: TUuid; }, { previous: IBootstrap | undefined; tempUuid: string; }> = useCreateFolder()
  const createTag: UseMutationResult<ITag, IApiError, { name: string; uuid?: TUuid; }, { previous: IBootstrap | undefined; tempUuid: string; }> = useCreateTag()
  const { renameFolder, deleteFolder, renameTag, deleteTag }: ISidebarActions = useSidebarActions()

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
          onDeleteFolder={deleteFolder}
          onDeleteTag={deleteTag}
          onRenameFolder={renameFolder}
          onRenameTag={renameTag}
        />
      </Stack>
    </ScrollArea>
  )
})
