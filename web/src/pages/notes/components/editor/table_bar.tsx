import { memo, useCallback, useRef } from 'react'

import { Group, ScrollArea, Text } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import type { Editor } from '@tiptap/react'

/**
 * Only rendered while the cursor is inside a table.
 */
export const TableBar: React.MemoExoticComponent<({ editor }: { editor: Editor | null; }) => React.JSX.Element | null> = memo(function TableBar({ editor }: { editor: Editor | null }) {
  const viewportRef: React.RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null)

  const handleWheel: (e: React.WheelEvent) => void = useCallback((e: React.WheelEvent) => {
    if (e.deltaY && !e.deltaX && viewportRef.current) {
      viewportRef.current.scrollLeft += e.deltaY
    }
  }, [])

  if (!editor?.isActive('table')) return null

  return (
    <ScrollArea
      bg="var(--mantine-color-blue-light)"
      offsetScrollbars="x"
      scrollbars="x"
      scrollbarSize={4}
      style={{ overflow: 'hidden' }}
      type="hover"
      viewportRef={viewportRef}
      onWheel={handleWheel}
    >
      <Group align="center" gap="xs" p={6} style={{ minWidth: 'max-content' }} wrap="nowrap">
        <Text c="blue" fw={700} px={4} size="xs" tt="uppercase">
          Table
        </Text>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.TableColumnBefore />
          <RichTextEditor.TableColumnAfter />
          <RichTextEditor.TableColumnDelete />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.TableRowBefore />
          <RichTextEditor.TableRowAfter />
          <RichTextEditor.TableRowDelete />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.TableToggleHeaderRow />
          <RichTextEditor.TableToggleHeaderColumn />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.TableMergeCells />
          <RichTextEditor.TableSplitCell />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.TableDelete />
        </RichTextEditor.ControlsGroup>
      </Group>
    </ScrollArea>
  )
})
