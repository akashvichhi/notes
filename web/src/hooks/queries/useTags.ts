import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import * as tagsApi from '@/api/tags'
import { ALL_NOTES_LABEL } from '@/constants/labels'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY } from '@/constants/queryKeys'
import { tagsRepo } from '@/db/tagsRepo'
import { getTagsArray } from '@/lib/bootstrap'
import { slugify } from '@/lib/slugify'
import { isNative } from '@/platform/isNative'
import { useUiStore } from '@/stores/uiStore'
import type { Bootstrap, Note, Tag, UUID } from '@/types/api'

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; uuid?: UUID }) => {
      const uuid = payload.uuid || crypto.randomUUID()
      return tagsApi.createTag({ ...payload, uuid })
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      const previous = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const tempUuid = payload.uuid || crypto.randomUUID()
      payload.uuid = tempUuid
      const slug = slugify(payload.name)

      const optimisticTag: Tag = {
        uuid: tempUuid,
        name: payload.name,
        slug,
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getTagsArray(old.tags)
        return {
          ...old,
          tags:   [...current, optimisticTag],
          counts: {
            ...old.counts,
            tags: {
              ...old.counts?.tags,
              [slug]: 0,
            },
          },
        }
      })

      return { previous, tempUuid }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(BOOTSTRAP_KEY, ctx.previous)
      notifications.show({ color: 'red', message: "Couldn't create tag." })
    },
    onSuccess: async (realTag, _v, ctx) => {
      if (isNative()) {
        await tagsRepo.upsert({
          uuid:            realTag.uuid,
          container:       'cloud',
          name:            realTag.name,
          slug:            realTag.slug,
          deleted_at:      null,
          dirty:           false,
          server_revision: null,
        })
      }
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getTagsArray(old.tags)
        return {
          ...old,
          tags: current.map((t) => (t.uuid === ctx?.tempUuid ? realTag : t)),
        }
      })
    },
  })
}

export function useRenameTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      tagsApi.renameTag(uuid, name),
    onMutate: async ({ uuid, name }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })

      const newSlug = slugify(name)
      const oldTag = prevBootstrap ? getTagsArray(prevBootstrap.tags).find((t) => t.uuid === uuid) : null
      const oldSlug = oldTag?.slug

      const currentScope = useUiStore.getState().scope
      const wasActiveScope =
        currentScope.kind === 'tag'
        && (currentScope.slug === oldSlug || currentScope.label === oldTag?.name)
      const prevScope = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'tag', slug: newSlug, label: name })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getTagsArray(old.tags)
        const nextTagCounts = { ...old.counts?.tags }
        if (oldSlug && oldSlug !== newSlug) {
          nextTagCounts[newSlug] = nextTagCounts[oldSlug] ?? 0
          delete nextTagCounts[oldSlug]
        }
        return {
          ...old,
          tags:   current.map((t) => (t.uuid === uuid ? { ...t, name, slug: newSlug } : t)),
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      notifications.show({ color: 'red', message: "Couldn't rename tag." })
    },
    onSuccess: async (realTag) => {
      if (isNative()) {
        await tagsRepo.upsert({
          uuid:            realTag.uuid,
          container:       'cloud',
          name:            realTag.name,
          slug:            realTag.slug,
          deleted_at:      null,
          dirty:           false,
          server_revision: null,
        })
      }
    },
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tagsApi.deleteTag,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentTags = prevBootstrap ? getTagsArray(prevBootstrap.tags) : []
      const tagToDelete = currentTags.find((t) => t.uuid === uuid)

      const currentScope = useUiStore.getState().scope
      const wasActiveScope =
        currentScope.kind === 'tag'
        && (currentScope.slug === tagToDelete?.slug || currentScope.label === tagToDelete?.name)
      const prevScope = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'all', label: ALL_NOTES_LABEL })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old) => {
        if (!old) return old
        const current = getTagsArray(old.tags)
        const nextTagCounts = { ...old.counts?.tags }
        if (tagToDelete) {
          delete nextTagCounts[tagToDelete.slug]
        }
        return {
          ...old,
          tags:   current.filter((t) => t.uuid !== uuid),
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      if (tagToDelete) {
        const tagName = tagToDelete.name
        qc.setQueriesData({ queryKey: NOTE_KEY }, (old: Note | undefined) => {
          if (!old?.tags) return old
          return {
            ...old,
            tags: old.tags.filter((t) => t !== tagName),
          }
        })
      }

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      notifications.show({ color: 'red', message: "Couldn't delete tag." })
    },
    onSuccess: async (_data, uuid) => {
      if (isNative()) {
        await tagsRepo.hardDelete(uuid, 'cloud')
      }
    },
  })
}
