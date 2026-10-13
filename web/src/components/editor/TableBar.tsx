import { Button, Group, Text } from '@mantine/core'
import type { Editor } from '@tiptap/react'

/**
 * Only rendered while the cursor is inside a table. Eleven more buttons in the
 * permanent toolbar would make it unusable.
 */
export function TableBar({ editor }: { editor: Editor | null }) {
  if (!editor?.isActive('table')) return null

  const chain = () => editor.chain().focus()

  return (
    <Group gap="xs" p={6} bg="var(--mantine-color-blue-light)" wrap="wrap">
      <Text size="xs" fw={700} tt="uppercase" c="blue">Table</Text>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={() => chain().addColumnBefore().run()}>+ Col ←</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().addColumnAfter().run()}>+ Col →</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().deleteColumn().run()}>− Col</Button>
      </Button.Group>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={() => chain().addRowBefore().run()}>+ Row ↑</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().addRowAfter().run()}>+ Row ↓</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().deleteRow().run()}>− Row</Button>
      </Button.Group>

      <Button.Group>
        <Button size="compact-xs" variant="default" onClick={() => chain().toggleHeaderRow().run()}>Header row</Button>
        <Button size="compact-xs" variant="default" onClick={() => chain().toggleHeaderColumn().run()}>Header col</Button>
      </Button.Group>

      <Button size="compact-xs" variant="default" color="red" onClick={() => chain().deleteTable().run()}>
        Delete table
      </Button>
    </Group>
  )
}
