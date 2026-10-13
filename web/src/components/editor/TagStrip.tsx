import { Badge, Button, Group, Popover, Stack, TextInput } from '@mantine/core'
import { IconCheck, IconPlus, IconSearch } from '@tabler/icons-react'
import { memo, useCallback, useMemo, useState } from 'react'

import { useBootstrap } from '@/hooks/queries/useBootstrap'
import { syncNoteTags } from '@/api/notes'
import { useQueryClient } from '@tanstack/react-query'
import { BOOTSTRAP_KEY } from '@/hooks/queries/useBootstrap'
import { NOTES_KEY } from '@/hooks/queries/useNotes'
import type { Note } from '@/types/api'

export const TagStrip = memo(function TagStrip({ note }: { note: Note }) {
  const { tags } = useBootstrap()
  const qc = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')

  const activeNames = useMemo(() => note.tags ?? [], [note.tags])

  const handleToggle = useCallback(
    async (tagName: string) => {
      let next: string[]
      if (activeNames.includes(tagName)) {
        next = activeNames.filter((t) => t !== tagName)
      } else {
        next = [...activeNames, tagName]
      }
      await syncNoteTags(note.uuid, next)
      qc.invalidateQueries({ queryKey: BOOTSTRAP_KEY })
      qc.invalidateQueries({ queryKey: NOTES_KEY })
      qc.invalidateQueries({ queryKey: ['note', note.uuid] })
    },
    [activeNames, note.uuid, qc]
  )

  const handleCreate = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return
    await handleToggle(trimmed)
    setQuery('')
  }, [handleToggle, query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, query])

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase()
    return !q || filtered.some((t) => t.name.toLowerCase() === q)
  }, [filtered, query])

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.currentTarget.value)
  }, [])

  const handleQueryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleCreate()
    },
    [handleCreate]
  )

  const handleToggleOpened = useCallback(() => {
    setOpened((o) => !o)
  }, [])

  return (
    <Group gap="xs" mb="md" wrap="wrap">
      {activeNames.map((tag) => (
        <Badge key={tag} variant="light" size="sm">
          #{tag}
        </Badge>
      ))}

      <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow shadow="md">
        <Popover.Target>
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconPlus size={12} />}
            onClick={handleToggleOpened}
          >
            Add tag
          </Button>
        </Popover.Target>

        <Popover.Dropdown p="xs" w={220}>
          <Stack gap="xs">
            <TextInput
              size="xs"
              placeholder="Search or create tag"
              leftSection={<IconSearch size={12} />}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleQueryKeyDown}
            />

            <Stack gap={2}>
              {filtered.map((t) => {
                const isSelected = activeNames.includes(t.name) || activeNames.includes(t.slug)
                return (
                  <Button
                    key={t.uuid}
                    size="compact-xs"
                    variant={isSelected ? 'light' : 'subtle'}
                    justify="space-between"
                    fullWidth
                    rightSection={isSelected ? <IconCheck size={12} /> : null}
                    onClick={() => handleToggle(t.name)}
                  >
                    #{t.name}
                  </Button>
                )
              })}

              {!hasExactMatch && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="blue"
                  leftSection={<IconPlus size={12} />}
                  onClick={handleCreate}
                >
                  Create #{query.trim()}
                </Button>
              )}
            </Stack>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  )
})
