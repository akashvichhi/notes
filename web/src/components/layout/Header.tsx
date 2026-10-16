import { memo, useCallback, useState } from 'react'

import { ActionIcon, Group, Text, UnstyledButton, useMantineColorScheme } from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import {
  IconChevronLeft, IconMenu2, IconMoon, IconRefresh, IconSearch, IconSun,
} from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'

import { fetchNote } from '@/api/notes'
import { BOOTSTRAP_KEY, LOCAL_SIDEBAR_KEY, NOTE_KEY, NOTES_KEY } from '@/constants/queryKeys'
import { getDb } from '@/db/connection'
import { notesRepo } from '@/db/notesRepo'
import { tagsRepo } from '@/db/tagsRepo'
import { useMe } from '@/hooks/queries/useAuth'
import { useIsPhone } from '@/hooks/useIsPhone'
import { clearDraft } from '@/lib/drafts'
import { showErrorToast, showSuccessToast } from '@/lib/notifications'
import { isNative } from '@/platform/isNative'
import { useTabsStore } from '@/stores/tabsStore'
import { useUiStore } from '@/stores/uiStore'
import { outbox } from '@/sync/outbox'
import { pull } from '@/sync/pull'

import { AccountMenu } from './AccountMenu'

export const Header = memo(function Header() {
  const isPhone = useIsPhone()
  const { data: user } = useMe()
  const { view, setView, toggleNav, scope } = useUiStore()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.uuid === s.activeUuid))
  const activeTitle = activeTab?.title

  const handleBack = useCallback(() => {
    setView(view === 'editor' ? 'list' : 'folders')
  }, [view, setView])

  const handleOpenSpotlight = useCallback(() => {
    spotlight.open()
  }, [])

  const qc = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true)

      // 1. Cancel pending editor autosave or debounce to accept risk of losing unsaved edits
      const cancelSave = useUiStore.getState().cancelPendingSave
      if (cancelSave) {
        cancelSave()
      }

      // Mark all tabs as not dirty and clear any localStorage drafts
      const tabs = useTabsStore.getState().tabs
      for (const t of tabs) {
        useTabsStore.getState().setDirty(t.uuid, false)
        void clearDraft(t.uuid)
      }

      // 2. Find all notes currently loaded and cached in React Query
      const cachedNoteQueries = qc.getQueryCache().findAll({ queryKey: NOTE_KEY })
      const cachedNoteUuids = cachedNoteQueries
        .map((q) => q.queryKey[1])
        .filter((u): u is string => typeof u === 'string' && Boolean(u))

      if (isNative()) {
        if (!navigator.onLine) {
          showErrorToast('Offline. Cannot sync with remote server.')
          return
        }

        // Discard pending unpushed outbox ops for cached notes so unsaved edits do not overwrite server
        const pendingOps = await outbox.pending()
        const cachedSet = new Set(cachedNoteUuids)
        const db = await getDb()
        for (const op of pendingOps) {
          if (cachedSet.has(op.uuid)) {
            await db.execute('DELETE FROM outbox WHERE id = $1', [op.id])
          }
        }

        // Pull full remote bootstrap, folders, tags, active notes list, trashed notes, and prune deleted items
        await pull()

        // Fetch fresh note details for every note that was opened and cached in React Query
        await Promise.all(
          cachedNoteUuids.map(async (uuid) => {
            try {
              const local = await notesRepo.get(uuid)
              if (local?.container === 'local') {
                // Local notes refresh directly from SQLite
                const freshLocal = await notesRepo.get(uuid, 'local')
                if (freshLocal) {
                  qc.setQueryData([...NOTE_KEY, uuid], freshLocal)
                  useTabsStore.getState().setTitle(uuid, freshLocal.title)
                }
                return
              }

              // Cloud note: fetch latest from server
              const remote = await fetchNote(uuid)
              if (remote) {
                await notesRepo.upsert({
                  uuid:            remote.uuid,
                  container:       'cloud',
                  folder_uuid:     remote.folder?.uuid ?? null,
                  title:           remote.title,
                  title_locked:    Boolean(remote.title_locked),
                  body:            remote.body,
                  plain_text:      remote.plain_text ?? '',
                  excerpt:         remote.excerpt,
                  is_starred:      Boolean(remote.is_starred),
                  word_count:      remote.word_count,
                  updated_at:      remote.updated_at,
                  deleted_at:      remote.deleted_at,
                  server_version:  remote.version,
                  server_revision: null,
                  dirty:           false,
                })
                if (remote.tags) {
                  await tagsRepo.setNoteTags(remote.uuid, remote.tags, 'cloud')
                }
                qc.setQueryData([...NOTE_KEY, uuid], remote)
                useTabsStore.getState().setTitle(uuid, remote.title)
              }
            } catch (err: unknown) {
              const error = err as { response?: { status?: number }; status?: number }
              if (error.response?.status === 404 || error.status === 404) {
                useTabsStore.getState().close(uuid)
                qc.removeQueries({ queryKey: [...NOTE_KEY, uuid] })
                await notesRepo.hardDelete(uuid, 'cloud')
              }
            }
          })
        )
      } else {
        // Web platform: fetch latest from server for all cached notes
        if (!navigator.onLine) {
          showErrorToast('Offline. Cannot sync with remote server.')
          return
        }

        await Promise.all(
          cachedNoteUuids.map(async (uuid) => {
            try {
              const remote = await fetchNote(uuid)
              if (remote) {
                qc.setQueryData([...NOTE_KEY, uuid], remote)
                useTabsStore.getState().setTitle(uuid, remote.title)
              }
            } catch (err: unknown) {
              const error = err as { response?: { status?: number }; status?: number }
              if (error.response?.status === 404 || error.status === 404) {
                useTabsStore.getState().close(uuid)
                qc.removeQueries({ queryKey: [...NOTE_KEY, uuid] })
              }
            }
          })
        )
      }

      // Invalidate and refetch all lists, folders, tags, counts, and note queries
      await Promise.all([
        qc.refetchQueries({ queryKey: BOOTSTRAP_KEY, type: 'all' }),
        qc.refetchQueries({ queryKey: LOCAL_SIDEBAR_KEY, type: 'all' }),
        qc.refetchQueries({ queryKey: NOTES_KEY, type: 'all' }),
        qc.refetchQueries({ queryKey: NOTE_KEY, type: 'all' }),
      ])

      showSuccessToast('All notes and data refreshed from server')
    } catch {
      showErrorToast('Could not sync with remote server. Check your connection.')
    } finally {
      setIsRefreshing(false)
    }
  }, [qc])

  return (
    <Group gap="sm" h={52} px="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      {isPhone ? (
        <ActionIcon
          aria-label="Back" size="lg" style={{ visibility: view === 'folders' ? 'hidden' : 'visible' }}
          variant="subtle"
          onClick={handleBack}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
      ) : (
        // The sidebar toggle sits next to what it controls, at the far left.
        <ActionIcon aria-label="Toggle sidebar" size="lg" variant="subtle" onClick={toggleNav}>
          <IconMenu2 size={18} />
        </ActionIcon>
      )}

      {isPhone && (
        <Text truncate fw={600} size="md" style={{ flex: 1 }}>
          {view === 'editor' && activeTitle ? activeTitle : scope.label}
        </Text>
      )}

      <UnstyledButton
        aria-label="Search notes and actions"
        style={{ flex: 1, maxWidth: 460 }}
        visibleFrom="sm"
        onClick={handleOpenSpotlight}
      >
        <Group gap="xs" h={32} px="sm" style={{
          border:       '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}>
          <IconSearch opacity={0.6} size={15} />
          <Text c="dimmed" size="sm" style={{ flex: 1 }}>Search notes and actions…</Text>
          <Text c="dimmed" size="xs">⌘K</Text>
        </Group>
      </UnstyledButton>

      {isPhone && (
        <ActionIcon aria-label="Search" size="lg" variant="subtle" onClick={handleOpenSpotlight}>
          <IconSearch size={18} />
        </ActionIcon>
      )}

      <Group gap={4} ml="auto">
        {!!user && <ActionIcon
          aria-label="Refresh"
          loading={isRefreshing}
          size="lg"
          variant="subtle"
          onClick={handleRefresh}
        >
          <IconRefresh size={18} />
        </ActionIcon>}
        <ActionIcon aria-label="Toggle colour scheme" size="lg" variant="subtle" onClick={toggleColorScheme}>
          {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        <AccountMenu />
      </Group>
    </Group>
  )
})
