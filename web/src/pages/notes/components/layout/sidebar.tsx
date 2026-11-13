import { memo, useCallback } from 'react'

import { ScrollArea, Stack } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'

import { LOCAL_SIDEBAR_KEY } from '@src/constants/query_keys'
import { foldersRepo } from '@src/db/folders_repo'
import { tagsRepo } from '@src/db/tags_repo'
import { isNative } from '@src/platform/is_native'
import { useMe } from '@src/queries/auth_queries'
import { useBootstrap, useLocalSidebar } from '@src/queries/bootstrap_queries'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '@src/queries/folders_queries'
import { useCreateTag, useDeleteTag, useRenameTag } from '@src/queries/tags_queries'
import { useSyncStatus } from '@src/sync/engine'
import type { Container } from '@src/types/api'
import { slugify } from '@src/utils/slugify'

import { ContainerSection } from './container_section'

export const Sidebar = memo(function Sidebar() {
  const qc = useQueryClient()
  const { data: user } = useMe()
  const { folders, tags, counts } = useBootstrap()
  const { data: localData } = useLocalSidebar()
  const syncStatus = useSyncStatus()
  const native = isNative()
  const signedIn = Boolean(user)

  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const createTag = useCreateTag()
  const renameTag = useRenameTag()
  const deleteTag = useDeleteTag()

  const localFolders = localData?.folders ?? []
  const localTags = localData?.tags ?? []
  const localCounts = localData?.counts ?? {
    all:     0,
    starred: 0,
    trashed: 0,
    folders: {},
    tags:    {},
  }

  const refreshLocal = useCallback(() => {
    qc.invalidateQueries({ queryKey: LOCAL_SIDEBAR_KEY })
  }, [qc])

  const handleCreateFolder = useCallback(
    async (name: string, container: Container) => {
      if (container === 'cloud' && !signedIn) {
        return
      }
      if (container === 'local') {
        const uuid = crypto.randomUUID()
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

  const handleCreateTag = useCallback(
    async (name: string, container: Container) => {
      if (container === 'cloud' && !signedIn) {
        return
      }
      if (container === 'local') {
        const uuid = crypto.randomUUID()
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
          onCreateFolder={(name) => handleCreateFolder(name, 'cloud')}
          onCreateTag={(name) => handleCreateTag(name, 'cloud')}
          onDeleteFolder={(uuid) => deleteFolder.mutate(uuid)}
          onDeleteTag={(uuid) => deleteTag.mutate(uuid)}
          onRenameFolder={(uuid, name) => renameFolder.mutate({ uuid, name })}
          onRenameTag={(uuid, name) => renameTag.mutate({ uuid, name })}
        />

        {native && (
          <ContainerSection
            container="local"
            counts={localCounts}
            folders={localFolders}
            tags={localTags}
            title="On This Device"
            onCreateFolder={(name) => handleCreateFolder(name, 'local')}
            onCreateTag={(name) => handleCreateTag(name, 'local')}
            onDeleteFolder={async (uuid) => {
              await foldersRepo.softDelete(uuid, 'local')
              refreshLocal()
            }}
            onDeleteTag={async (uuid) => {
              await tagsRepo.softDelete(uuid, 'local')
              refreshLocal()
            }}
            onRenameFolder={async (uuid, name) => {
              const f = await foldersRepo.get(uuid, 'local')
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
            onRenameTag={async (uuid, name) => {
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
