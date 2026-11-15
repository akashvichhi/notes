import { useCallback, useMemo } from 'react'
import { type Location, type NavigateFunction, useLocation, useNavigate } from 'react-router'

import { type TBootstrapResult, useBootstrap } from '@src/queries/bootstrap_queries'
import { type TDeleteFolderMutation, type TRenameFolderMutation, useDeleteFolder, useRenameFolder } from '@src/queries/folders_queries'
import { type TDeleteTagMutation, type TRenameTagMutation, useDeleteTag, useRenameTag } from '@src/queries/tags_queries'
import { ROUTE_PATHS } from '@src/routes/route_paths'
import { scopePath } from '@src/routes/scope_location'
import type { ITag, TUuid } from '@src/types/api'
import { slugify } from '@src/utils/slugify'

import { type IScopeState, useScope } from './use_scope'

export interface ISidebarActions {
  renameFolder: (uuid: TUuid, name: string) => void
  deleteFolder: (uuid: TUuid) => void
  renameTag:    (uuid: TUuid, name: string) => void
  deleteTag:    (uuid: TUuid) => void
}

const REPLACE: { replace: true } = { replace: true }

/**
 * Renaming and deleting folders and tags, keeping the URL right when the open
 * list is the one changed: a deleted list goes to All notes and a renamed tag
 * moves to its new slug. Both happen at once, like the sidebar, and go back if
 * the change fails.
 */
export function useSidebarActions(): ISidebarActions {
  const navigate: NavigateFunction = useNavigate()
  const location: Location = useLocation()
  const { scope }: IScopeState = useScope()
  const { tags }: TBootstrapResult = useBootstrap()
  const renameFolderMutation: TRenameFolderMutation = useRenameFolder()
  const deleteFolderMutation: TDeleteFolderMutation = useDeleteFolder()
  const renameTagMutation: TRenameTagMutation = useRenameTag()
  const deleteTagMutation: TDeleteTagMutation = useDeleteTag()

  const currentUrl: string = `${location.pathname}${location.search}`

  const isOpenTag: (uuid: TUuid) => boolean = useCallback((uuid: TUuid): boolean => {
    if (scope.kind !== 'tag') return false
    return tags.some((t: ITag) => t.uuid === uuid && t.slug === scope.slug)
  }, [scope, tags])

  const renameFolder: (uuid: TUuid, name: string) => void = useCallback((uuid: TUuid, name: string): void => {
    // The folder keeps its uuid, so its URL does not change.
    renameFolderMutation.mutate({ uuid, name })
  }, [renameFolderMutation])

  const deleteFolder: (uuid: TUuid) => void = useCallback((uuid: TUuid): void => {
    const isOpen: boolean = scope.kind === 'folder' && scope.uuid === uuid
    if (isOpen) void navigate(ROUTE_PATHS.HOME, REPLACE)
    deleteFolderMutation.mutate(uuid, {
      onError: (): void => {
        if (isOpen) void navigate(currentUrl, REPLACE)
      },
    })
  }, [scope, navigate, deleteFolderMutation, currentUrl])

  const renameTag: (uuid: TUuid, name: string) => void = useCallback((uuid: TUuid, name: string): void => {
    const isOpen: boolean = isOpenTag(uuid)
    // The same slug the sidebar shows until the server answers.
    if (isOpen) void navigate(scopePath({ kind: 'tag', slug: slugify(name) }), REPLACE)
    renameTagMutation.mutate({ uuid, name }, {
      onError: (): void => {
        if (isOpen) void navigate(currentUrl, REPLACE)
      },
    })
  }, [isOpenTag, navigate, renameTagMutation, currentUrl])

  const deleteTag: (uuid: TUuid) => void = useCallback((uuid: TUuid): void => {
    const isOpen: boolean = isOpenTag(uuid)
    if (isOpen) void navigate(ROUTE_PATHS.HOME, REPLACE)
    deleteTagMutation.mutate(uuid, {
      onError: (): void => {
        if (isOpen) void navigate(currentUrl, REPLACE)
      },
    })
  }, [isOpenTag, navigate, deleteTagMutation, currentUrl])

  return useMemo(
    (): ISidebarActions => ({ renameFolder, deleteFolder, renameTag, deleteTag }),
    [renameFolder, deleteFolder, renameTag, deleteTag],
  )
}
