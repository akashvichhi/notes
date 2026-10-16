import { fetchBootstrap } from '@/api/bootstrap'
import { foldersRepo } from '@/db/foldersRepo'
import { getFoldersArray } from '@/lib/bootstrap'
import { isNative } from '@/platform/isNative'
import type { Container, Folder } from '@/types/api'

export const foldersSource = {
  async list(container: Container = 'cloud'): Promise<Folder[]> {
    if (isNative()) {
      return foldersRepo.list(container)
    }

    if (container === 'local') return []

    const boot = await fetchBootstrap()
    return getFoldersArray(boot.folders)
  },
}
