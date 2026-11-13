import { fetchBootstrap } from '@src/api/bootstrap_api'
import { foldersRepo } from '@src/db/folders_repo'
import { isNative } from '@src/platform/is_native'
import type { Bootstrap, Container, Folder } from '@src/types/api'
import { getFoldersArray } from '@src/utils/bootstrap_lists'

export const foldersSource: { list(container?: Container): Promise<Folder[]>; } = {
  async list(container: Container = 'cloud'): Promise<Folder[]> {
    if (isNative()) {
      return foldersRepo.list(container)
    }

    if (container === 'local') return []

    const boot: Bootstrap = await fetchBootstrap()
    return getFoldersArray(boot.folders)
  },
}
