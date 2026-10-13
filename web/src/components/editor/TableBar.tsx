import { Button, Group, Text } from '@mantine/core'
import type { Editor } from '@tiptap/react'
import { memo, useCallback } from 'react'

/**
 * Only rendered while the cursor is inside a table. Eleven more buttons in the
 * permanent toolbar would make it unusable.
 */
export const TableBar = memo(function TableBar({ editor }: { editor: Editor | null }) {
  const addColBefore = useCallback(() => editor?.chain().focus().addColumnBefore().run(), [editor])
  const addColAfter = useCallback(() => editor?.chain().focus().addColumnAfter().run(), [editor])
  const deleteCol = useCallback(() => editor?.chain().focus().deleteColumn().run(), [editor])
  const addRowBefore = useCallback(() => editor?.chain().focus().addRowBefore().run(), [editor])
  const addRowAfter = useCallback(() => editor?.chain().focus().addRowAfter().run(), [editor])
  const deleteRow = useCallback(() => editor?.chain().focus().deleteRow().run(), [editor])
  const toggleHeaderRow = useCallback(() => editor?.chain().focus().toggleHeaderRow().run(), [editor])
  const toggleHeaderCol = useCallback(() => editor?.chain().focus().toggleHeaderColumn().run(), [editor])
  const deleteTable = useCallback(() => editor?.chain().focus().deleteTable().run(), [editor])

  if (!editor?.isActive('table')) return null

  return (
    <Group gap="xs" p={6} bg="var(--mantine-color-blue-light)" wrap="wrap">
      <Text size="xs" fw={700} tt="uppercase" c="blue">Table</Text>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={addColBefore}>+ Col ←</Button>
        <Button size="compact-xs" variant="default" onClick={addColAfter}>+ Col →</Button>
        <Button size="compact-xs" variant="default" onClick={deleteCol}>− Col</Button>
      </Button.Group>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={addRowBefore}>+ Row ↑</Button>
        <Button size="compact-xs" variant="default" onClick={addRowAfter}>+ Row ↓</Button>
        <Button size="compact-xs" variant="default" onClick={deleteRow}>− Row</Button>
      </Button.Group>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={toggleHeaderRow}>Header row</Button>
        <Button size="compact-xs" variant="default" onClick={toggleHeaderCol}>Header col</Button>
      </Button.Group>

      <Button size="compact-xs" variant="default" color="red" onClick={deleteTable}>
        Delete table
      </Button>
    </Group>
  )
})
