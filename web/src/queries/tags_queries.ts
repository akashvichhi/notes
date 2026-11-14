import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult } from '@tanstack/react-query'

import type { ApiError } from '@src/api/api_client'
import * as tagsApi from '@src/api/tags_api'
import { ALL_NOTES_LABEL } from '@src/constants/labels'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY } from '@src/constants/query_keys'
import { useUiStore } from '@src/stores/ui_store'
import type { Scope } from '@src/stores/ui_store'
import type { Bootstrap, Note, Tag, UUID } from '@src/types/api'
import type { ISidebarItemContext } from '@src/types/mutation_context'
import { getTagsArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'
import { slugify } from '@src/utils/slugify'

export interface IRenameTagVars { uuid: string; name: string }
export type TRenameTagMutation = UseMutationResult<Tag, ApiError, IRenameTagVars, ISidebarItemContext>
export type TDeleteTagMutation = UseMutationResult<void, ApiError, string, ISidebarItemContext>

export function useCreateTag(): UseMutationResult<Tag, ApiError, { name: string; uuid?: UUID; }, { previous: Bootstrap | undefined; tempUuid: string; }> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; uuid?: UUID }) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      return tagsApi.createTag({ ...payload, uuid })
    },
    onMutate: async (payload: { name: string; uuid?: UUID; }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      const previous: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const tempUuid: string = payload.uuid || crypto.randomUUID()
      payload.uuid = tempUuid
      const slug: string = slugify(payload.name)

      const optimisticTag: Tag = {
        uuid: tempUuid,
        name: payload.name,
        slug,
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Tag[] = getTagsArray(old.tags)
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
    onError: (_err: ApiError, _v: { name: string; uuid?: UUID; }, ctx: { previous: Bootstrap | undefined; tempUuid: string; } | undefined) => {
      if (ctx?.previous) qc.setQueryData(BOOTSTRAP_KEY, ctx.previous)
      showErrorToast(MESSAGES.TAG_CREATE_FAILED)
    },
    onSuccess: (realTag: Tag, _v: { name: string; uuid?: UUID; }, ctx: { previous: Bootstrap | undefined; tempUuid: string; }) => {
      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Tag[] = getTagsArray(old.tags)
        return {
          ...old,
          tags: current.map((t: Tag) => (t.uuid === ctx?.tempUuid ? realTag : t)),
        }
      })
    },
  })
}

export function useRenameTag(): TRenameTagMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      tagsApi.renameTag(uuid, name),
    onMutate: async ({ uuid, name }: { uuid: string; name: string; }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      const newSlug: string = slugify(name)
      const oldTag: Tag | null | undefined = prevBootstrap ? getTagsArray(prevBootstrap.tags).find((t: Tag) => t.uuid === uuid) : null
      const oldSlug: string | undefined = oldTag?.slug

      const currentScope: Scope = useUiStore.getState().scope
      const wasActiveScope: boolean =
        currentScope.kind === 'tag'
        && (currentScope.slug === oldSlug || currentScope.label === oldTag?.name)
      const prevScope: Scope | null = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'tag', slug: newSlug, label: name })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Tag[] = getTagsArray(old.tags)
        const nextTagCounts: { [x: string]: number; } = { ...old.counts?.tags }
        if (oldSlug && oldSlug !== newSlug) {
          nextTagCounts[newSlug] = nextTagCounts[oldSlug] ?? 0
          delete nextTagCounts[oldSlug]
        }
        return {
          ...old,
          tags:   current.map((t: Tag) => (t.uuid === uuid ? { ...t, name, slug: newSlug } : t)),
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err: ApiError, _v: { uuid: string; name: string }, ctx: ISidebarItemContext | undefined) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      showErrorToast(MESSAGES.TAG_RENAME_FAILED)
    },
  })
}

export function useDeleteTag(): TDeleteTagMutation {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: tagsApi.deleteTag,
    onMutate:   async (uuid: string) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const prevBootstrap: Bootstrap | undefined = qc.getQueryData<Bootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentTags: Tag[] = prevBootstrap ? getTagsArray(prevBootstrap.tags) : []
      const tagToDelete: Tag | undefined = currentTags.find((t: Tag) => t.uuid === uuid)

      const currentScope: Scope = useUiStore.getState().scope
      const wasActiveScope: boolean =
        currentScope.kind === 'tag'
        && (currentScope.slug === tagToDelete?.slug || currentScope.label === tagToDelete?.name)
      const prevScope: Scope | null = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'all', label: ALL_NOTES_LABEL })
      }

      qc.setQueryData<Bootstrap>(BOOTSTRAP_KEY, (old: NoInfer<Bootstrap> | undefined) => {
        if (!old) return old
        const current: Tag[] = getTagsArray(old.tags)
        const nextTagCounts: { [x: string]: number; } = { ...old.counts?.tags }
        if (tagToDelete) {
          delete nextTagCounts[tagToDelete.slug]
        }
        return {
          ...old,
          tags:   current.filter((t: Tag) => t.uuid !== uuid),
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      if (tagToDelete) {
        const tagName: string = tagToDelete.name
        qc.setQueriesData({ queryKey: NOTE_KEY }, (old: Note | undefined) => {
          if (!old?.tags) return old
          return {
            ...old,
            tags: old.tags.filter((t: string) => t !== tagName),
          }
        })
      }

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err: ApiError, _v: string, ctx: ISidebarItemContext | undefined) => {
      if (ctx?.prevScope) {
        useUiStore.getState().setScope(ctx.prevScope)
      }
      if (ctx?.prevBootstrap) qc.setQueryData(BOOTSTRAP_KEY, ctx.prevBootstrap)
      if (ctx?.prevNotes) {
        ctx.prevNotes.forEach(([queryKey, data]: [readonly unknown[], unknown]) => qc.setQueryData(queryKey, data))
      }
      showErrorToast(MESSAGES.TAG_DELETE_FAILED)
    },
  })
}
