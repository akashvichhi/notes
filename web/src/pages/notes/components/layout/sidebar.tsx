import { memo, useCallback } from 'react'

import { ScrollArea, Stack } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import { LOCAL_SIDEBAR_KEY } from '@src/constants/query_keys'
import { foldersRepo } from '@src/db/folders_repo'
import { tagsRepo } from '@src/db/tags_repo'
import { isNative } from '@src/platform/is_native'
import { useMe } from '@src/queries/auth_queries'
import { useBootstrap, useLocalSidebar } from '@src/queries/bootstrap_queries'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@src/queries/folders_queries'
import type { TDeleteFolderMutation, TRenameFolderMutation } from '@src/queries/folders_queries'
import { useCreateTag, useDeleteTag, useRenameTag } from '@src/queries/tags_queries'
import type { TDeleteTagMutation, TRenameTagMutation } from '@src/queries/tags_queries'
import { useSyncStatus } from '@src/sync/engine'
import type { SyncSnapshot } from '@src/sync/engine'
import type { Bootstrap, Container, Counts, Folder, Tag, UUID } from '@src/types/api'
import { slugify } from '@src/utils/slugify'

import { ContainerSection } from './container_section'



export const Sidebar: React.MemoExoticComponent<() => React.JSX.Element> = memo(function Sidebar() {
  const qc: QueryClient = useQueryClient()
  const { data: user } = useMe()
  const { folders, tags, counts } = useBootstrap()
  const { data: localData } = useLocalSidebar()
  const syncStatus: SyncSnapshot = useSyncStatus()
  const native: boolean = isNative()
  const signedIn: boolean = Boolean(user)

  const createFolder: UseMutationResult<Folder, ApiError, { name: string; parent_uuid?: UUID; color?: string; uuid?: UUID; }, { previous: Bootstrap | undefined; tempUuid: string; }> = useCreateFolder()
  const renameFolder: TRenameFolderMutation = useRenameFolder()
  const deleteFolder: TDeleteFolderMutation = useDeleteFolder()
  const createTag: UseMutationResult<Tag, ApiError, { name: string; uuid?: UUID; }, { previous: Bootstrap | undefined; tempUuid: string; }> = useCreateTag()
  const renameTag: TRenameTagMutation = useRenameTag()
  const deleteTag: TDeleteTagMutation = useDeleteTag()

  const localFolders: Folder[] = localData?.folders ?? []
  const localTags: Tag[] = localData?.tags ?? []
  const localCounts: Counts = localData?.counts ?? {
    all:     0,
    starred: 0,
    trashed: 0,
    folders: {},
    tags:    {},
  }

  const refreshLocal: () => void = useCallback(() => {
    qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
  }, [qc])

  const handleCreateFolder: (name: string, container: Container) => Promise<void> = useCallback(
    async (name: string, container: Container) => {
      if (container === 'cloud' && !signedIn) {
        return
      }
      if (container === 'local') {
        const uuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
        await foldersRepo.upsert({
          uuid,
          container:       'local',
          parent_uuid:     null,
          name,
          color:           null,
          position:        localFolders.length,
          deleted_at:      null,
          dirty:           false,
          server_revision: null,
        })
        refreshLocal()
      } else {
        createFolder.mutate({ name })
      }
    },
    [createFolder, localFolders.length, refreshLocal, signedIn],
  )

  const handleCreateTag: (name: string, container: Container) => Promise<void> = useCallback(
    async (name: string, container: Container) => {
      if (container === 'cloud' && !signedIn) {
        return
      }
      if (container === 'local') {
        const uuid: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID()
        await tagsRepo.upsert({
          uuid,
          container:       'local',
          name,
          slug:            slugify(name),
          deleted_at:      null,
          dirty:           false,
          server_revision: null,
        })
        refreshLocal()
      } else {
        createTag.mutate({ name })
      }
    },
    [createTag, refreshLocal, signedIn],
  )

  return (
    <ScrollArea h="100%">
      <Stack gap="xs" p="xs">
        <ContainerSection
          container="cloud"
          counts={counts ?? undefined}
          folders={folders}
          signedIn={signedIn}
          syncState={native && signedIn ? syncStatus.state : undefined}
          tags={tags}
          title="Cloud"
          onCreateFolder={(name: string) => handleCreateFolder(name, 'cloud')}
          onCreateTag={(name: string) => handleCreateTag(name, 'cloud')}
          onDeleteFolder={(uuid: string) => deleteFolder.mutate(uuid)}
          onDeleteTag={(uuid: string) => deleteTag.mutate(uuid)}
          onRenameFolder={(uuid: string, name: string) => renameFolder.mutate({ uuid, name })}
          onRenameTag={(uuid: string, name: string) => renameTag.mutate({ uuid, name })}
        />

        {native && (
          <ContainerSection
            container="local"
            counts={localCounts}
            folders={localFolders}
            tags={localTags}
            title="On This Device"
            onCreateFolder={(name: string) => handleCreateFolder(name, 'local')}
            onCreateTag={(name: string) => handleCreateTag(name, 'local')}
            onDeleteFolder={async (uuid: string) => {
              await foldersRepo.softDelete(uuid, 'local')
              refreshLocal()
            }}
            onDeleteTag={async (uuid: string) => {
              await tagsRepo.softDelete(uuid, 'local')
              refreshLocal()
            }}
            onRenameFolder={async (uuid: string, name: string) => {
              const f: Folder | null = await foldersRepo.get(uuid, 'local')
              if (f) {
                await foldersRepo.upsert({
                  ...f,
                  container:       'local',
                  name,
                  deleted_at:      null,
                  dirty:           false,
                  server_revision: null,
                })
                refreshLocal()
              }
            }}
            onRenameTag={async (uuid: string, name: string) => {
              await tagsRepo.upsert({
                uuid,
                container:       'local',
                name,
                slug:            slugify(name),
                deleted_at:      null,
                dirty:           false,
                server_revision: null,
              })
              refreshLocal()
            }}
          />
        )}
      </Stack>
    </ScrollArea>
  )
})
