import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import * as tagsApi from '@src/api/tags_api'
import { ALL_NOTES_LABEL } from '@src/constants/labels'
import { MESSAGES } from '@src/constants/messages'
import { BOOTSTRAP_KEY, NOTE_KEY, NOTES_KEY } from '@src/constants/query_keys'
import { useUiStore } from '@src/stores/ui_store'
import type { TScope } from '@src/stores/ui_store'
import type { IBootstrap, INote, ITag, TUuid } from '@src/types/api'
import type { ISidebarItemContext } from '@src/types/mutation_context'
import { getTagsArray } from '@src/utils/bootstrap_lists'
import { showErrorToast } from '@src/utils/notifications'
import { slugify } from '@src/utils/slugify'

export interface IRenameTagVars { uuid: string; name: string }
export type TRenameTagMutation = UseMutationResult<ITag, IApiError, IRenameTagVars, ISidebarItemContext>
export type TDeleteTagMutation = UseMutationResult<void, IApiError, string, ISidebarItemContext>

export function useCreateTag(): UseMutationResult<ITag, IApiError, { name: string; uuid?: TUuid; }, { previous: IBootstrap | undefined; tempUuid: string; }> {
  const qc: QueryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; uuid?: TUuid }) => {
      const uuid: string = payload.uuid || crypto.randomUUID()
      return tagsApi.createTag({ ...payload, uuid })
    },
    onMutate: async (payload: { name: string; uuid?: TUuid; }) => {
      await qc.cancelQueries({ queryKey: BOOTSTRAP_KEY })
      const previous: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const tempUuid: string = payload.uuid || crypto.randomUUID()
      payload.uuid = tempUuid
      const slug: string = slugify(payload.name)

      const optimisticTag: ITag = {
        uuid: tempUuid,
        name: payload.name,
        slug,
      }

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: ITag[] = getTagsArray(old.tags)
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
    onError: (_err: IApiError, _v: { name: string; uuid?: TUuid; }, ctx: { previous: IBootstrap | undefined; tempUuid: string; } | undefined) => {
      if (ctx?.previous) qc.setQueryData(BOOTSTRAP_KEY, ctx.previous)
      showErrorToast(MESSAGES.TAG_CREATE_FAILED)
    },
    onSuccess: (realTag: ITag, _v: { name: string; uuid?: TUuid; }, ctx: { previous: IBootstrap | undefined; tempUuid: string; }) => {
      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: ITag[] = getTagsArray(old.tags)
        return {
          ...old,
          tags: current.map((t: ITag) => (t.uuid === ctx?.tempUuid ? realTag : t)),
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
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      const newSlug: string = slugify(name)
      const oldTag: ITag | null | undefined = prevBootstrap ? getTagsArray(prevBootstrap.tags).find((t: ITag) => t.uuid === uuid) : null
      const oldSlug: string | undefined = oldTag?.slug

      const currentScope: TScope = useUiStore.getState().scope
      const wasActiveScope: boolean =
        currentScope.kind === 'tag'
        && (currentScope.slug === oldSlug || currentScope.label === oldTag?.name)
      const prevScope: TScope | null = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'tag', slug: newSlug, label: name })
      }

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: ITag[] = getTagsArray(old.tags)
        const nextTagCounts: { [x: string]: number; } = { ...old.counts?.tags }
        if (oldSlug && oldSlug !== newSlug) {
          nextTagCounts[newSlug] = nextTagCounts[oldSlug] ?? 0
          delete nextTagCounts[oldSlug]
        }
        return {
          ...old,
          tags:   current.map((t: ITag) => (t.uuid === uuid ? { ...t, name, slug: newSlug } : t)),
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err: IApiError, _v: { uuid: string; name: string }, ctx: ISidebarItemContext | undefined) => {
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
      const prevBootstrap: IBootstrap | undefined = qc.getQueryData<IBootstrap>(BOOTSTRAP_KEY)
      const prevNotes: [readonly unknown[], unknown][] = qc.getQueriesData({ queryKey: NOTES_KEY })

      const currentTags: ITag[] = prevBootstrap ? getTagsArray(prevBootstrap.tags) : []
      const tagToDelete: ITag | undefined = currentTags.find((t: ITag) => t.uuid === uuid)

      const currentScope: TScope = useUiStore.getState().scope
      const wasActiveScope: boolean =
        currentScope.kind === 'tag'
        && (currentScope.slug === tagToDelete?.slug || currentScope.label === tagToDelete?.name)
      const prevScope: TScope | null = wasActiveScope ? currentScope : null
      if (wasActiveScope) {
        useUiStore.getState().setScope({ kind: 'all', label: ALL_NOTES_LABEL })
      }

      qc.setQueryData<IBootstrap>(BOOTSTRAP_KEY, (old: NoInfer<IBootstrap> | undefined) => {
        if (!old) return old
        const current: ITag[] = getTagsArray(old.tags)
        const nextTagCounts: { [x: string]: number; } = { ...old.counts?.tags }
        if (tagToDelete) {
          delete nextTagCounts[tagToDelete.slug]
        }
        return {
          ...old,
          tags:   current.filter((t: ITag) => t.uuid !== uuid),
          counts: {
            ...old.counts,
            tags: nextTagCounts,
          },
        }
      })

      if (tagToDelete) {
        const tagName: string = tagToDelete.name
        qc.setQueriesData({ queryKey: NOTE_KEY }, (old: INote | undefined) => {
          if (!old?.tags) return old
          return {
            ...old,
            tags: old.tags.filter((t: string) => t !== tagName),
          }
        })
      }

      return { prevBootstrap, prevNotes, prevScope }
    },
    onError: (_err: IApiError, _v: string, ctx: ISidebarItemContext | undefined) => {
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
