import { memo, useCallback, useMemo, useState } from 'react'

import { ActionIcon, Badge, Button, Group, Popover, Stack, TextInput } from '@mantine/core'
import { IconCheck, IconPlus, IconSearch, IconX } from '@tabler/icons-react'

import { useBootstrap } from '@/hooks/queries/useBootstrap'
import { useSyncNoteTags } from '@/hooks/queries/useNotes'
import type { Note } from '@/types/api'

export const TagStrip = memo(function TagStrip({ note }: { note: Note }) {
  const { tags } = useBootstrap()
  const syncTags = useSyncNoteTags()
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')

  const activeNames = useMemo(() => note.tags ?? [], [note.tags])

  const handleToggle = useCallback(
    (tagName: string) => {
      let next: string[]
      if (activeNames.includes(tagName)) {
        next = activeNames.filter((t) => t !== tagName)
      } else {
        next = [...activeNames, tagName]
      }
      syncTags.mutate({ uuid: note.uuid, names: next })
    },
    [activeNames, note.uuid, syncTags],
  )

  const handleCreate = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    handleToggle(trimmed)
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
    [handleCreate],
  )

  const handleToggleOpened = useCallback(() => {
    setOpened((o) => !o)
  }, [])

  return (
    <Group gap="xs" mb="md" wrap="wrap">
      {activeNames.map((tag) => (
        <Badge
          key={tag}
          pr={4}
          rightSection={
            <ActionIcon
              aria-label={`Remove tag ${tag}`}
              color="gray"
              component="span"
              size={14}
              variant="transparent"
              onClick={(e) => {
                e.stopPropagation()
                handleToggle(tag)
              }}
            >
              <IconX size={10} />
            </ActionIcon>
          }
          size="sm"
          variant="light"
        >
          #{tag}
        </Badge>
      ))}

      <Popover withArrow opened={opened} position="bottom-start" shadow="md" onChange={setOpened}>
        <Popover.Target>
          <Button
            leftSection={<IconPlus size={12} />}
            size="compact-xs"
            variant="subtle"
            onClick={handleToggleOpened}
          >
            Add tag
          </Button>
        </Popover.Target>

        <Popover.Dropdown p="xs" w={220}>
          <Stack gap="xs">
            <TextInput
              leftSection={<IconSearch size={12} />}
              placeholder="Search or create tag"
              size="xs"
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
                    fullWidth
                    justify="space-between"
                    rightSection={isSelected ? <IconCheck size={12} /> : null}
                    size="compact-xs"
                    variant={isSelected ? 'light' : 'subtle'}
                    onClick={() => handleToggle(t.name)}
                  >
                    #{t.name}
                  </Button>
                )
              })}

              {!hasExactMatch && (
                <Button
                  color="blue"
                  leftSection={<IconPlus size={12} />}
                  size="compact-xs"
                  variant="subtle"
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
