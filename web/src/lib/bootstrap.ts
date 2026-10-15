import type { Bootstrap, Folder, Tag } from '@/types/api'

export function getFoldersArray(folders: Bootstrap['folders'] | undefined): Folder[] {
  if (!folders) return []
  return Array.isArray(folders) ? folders : (folders.data ?? [])
}

export function getTagsArray(tags: Bootstrap['tags'] | undefined): Tag[] {
  if (!tags) return []
  return Array.isArray(tags) ? tags : (tags.data ?? [])
}
