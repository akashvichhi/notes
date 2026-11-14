import type { IBootstrap, IFolder, ITag } from '@src/types/api'

export function getFoldersArray(folders: IBootstrap['folders'] | undefined): IFolder[] {
  if (!folders) return []
  return Array.isArray(folders) ? folders : (folders.data ?? [])
}

export function getTagsArray(tags: IBootstrap['tags'] | undefined): ITag[] {
  if (!tags) return []
  return Array.isArray(tags) ? tags : (tags.data ?? [])
}
