import { useMemo } from 'react'
import { useLocation } from 'react-router'

import { ALL_NOTES_LABEL, searchResultsLabel, STARRED_LABEL, TAG_LABEL_PREFIX, TRASH_LABEL } from '@src/constants/labels'
import { type TBootstrapResult, useBootstrap } from '@src/queries/bootstrap_queries'
import { scopeFromLocation } from '@src/routes/scope_location'
import type { IFolder, ITag } from '@src/types/api'
import type { TScope } from '@src/types/scope'

export interface IScopeState {
  scope:     TScope
  label:     string
  /** The URL names a folder or tag the account no longer has. */
  isMissing: boolean
}

interface IScopeDetails {
  label:  string
  exists: boolean
}

function describeScope(scope: TScope, folders: IFolder[], tags: ITag[]): IScopeDetails {
  switch (scope.kind) {
    case 'all': return { label: ALL_NOTES_LABEL, exists: true }
    case 'starred': return { label: STARRED_LABEL, exists: true }
    case 'trash': return { label: TRASH_LABEL, exists: true }
    case 'search': return { label: searchResultsLabel(scope.q), exists: true }
    case 'folder': {
      const folder: IFolder | undefined = folders.find((f: IFolder) => f.uuid === scope.uuid)
      return { label: folder?.name ?? '', exists: Boolean(folder) }
    }
    case 'tag': {
      const tag: ITag | undefined = tags.find((t: ITag) => t.slug === scope.slug)
      return { label: tag ? `${TAG_LABEL_PREFIX}${tag.name}` : '', exists: Boolean(tag) }
    }
  }
}

/** The list the URL shows, with its heading (decision 13). */
export function useScope(): IScopeState {
  const { pathname, search } = useLocation()
  const { folders, tags, isSuccess }: TBootstrapResult = useBootstrap()

  const scope: TScope = useMemo(() => scopeFromLocation(pathname, search), [pathname, search])

  return useMemo((): IScopeState => {
    const { label, exists }: IScopeDetails = describeScope(scope, folders, tags)
    // Until the folders and tags have loaded, nothing is known to be missing.
    return { scope, label, isMissing: isSuccess && !exists }
  }, [scope, folders, tags, isSuccess])
}
