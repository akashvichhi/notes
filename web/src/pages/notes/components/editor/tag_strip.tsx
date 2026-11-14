import { memo, useCallback, useMemo, useState } from 'react'

import { ActionIcon, Badge, Button, Group, Popover, Stack, TextInput } from '@mantine/core'
import { IconCheck, IconPlus, IconSearch, IconX } from '@tabler/icons-react'

import { useBootstrap } from '@src/queries/bootstrap_queries'
import { useSyncNoteTags } from '@src/queries/notes_queries'
import type { TNoteTagsMutation } from '@src/queries/notes_queries'
import type { INote, ITag } from '@src/types/api'

export const TagStrip: React.MemoExoticComponent<({ note }: { note: INote; }) => React.JSX.Element> = memo(function TagStrip({ note }: { note: INote }) {
  const { tags } = useBootstrap()
  const syncTags: TNoteTagsMutation = useSyncNoteTags()
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')

  const activeNames: string[] = useMemo(() => note.tags ?? [], [note.tags])

  const handleToggle: (tagName: string) => void = useCallback(
    (tagName: string) => {
      let next: string[]
      if (activeNames.includes(tagName)) {
        next = activeNames.filter((t: string) => t !== tagName)
      } else {
        next = [...activeNames, tagName]
      }
      syncTags.mutate({ uuid: note.uuid, names: next })
    },
    [activeNames, note.uuid, syncTags],
  )

  const handleCreate: () => void = useCallback(() => {
    const trimmed: string = query.trim()
    if (!trimmed) return
    handleToggle(trimmed)
    setQuery('')
  }, [handleToggle, query])

  const filtered: ITag[] = useMemo(() => {
    const q: string = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t: ITag) => t.name.toLowerCase().includes(q))
  }, [tags, query])

  const hasExactMatch: boolean = useMemo(() => {
    const q: string = query.trim().toLowerCase()
    return !q || filtered.some((t: ITag) => t.name.toLowerCase() === q)
  }, [filtered, query])

  const handleQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.currentTarget.value)
  }, [])

  const handleQueryKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleCreate()
    },
    [handleCreate],
  )

  const handleToggleOpened: () => void = useCallback(() => {
    setOpened((o: boolean) => !o)
  }, [])

  return (
    <Group gap="xs" mb="md" wrap="wrap">
      {activeNames.map((tag: string) => (
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
              onClick={(e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
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
              {filtered.map((t: ITag) => {
                const isSelected: boolean = activeNames.includes(t.name) || activeNames.includes(t.slug)
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
