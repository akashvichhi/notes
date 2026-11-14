import type { IBootstrap, IFolder, ITag } from '@src/types/api'

export function getFoldersArray(folders: IBootstrap['folders'] | undefined): IFolder[] {
  return folders ?? []
}

export function getTagsArray(tags: IBootstrap['tags'] | undefined): ITag[] {
  return tags ?? []
}
