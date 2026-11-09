import { memo, useCallback, useRef } from 'react'

import { Group, ScrollArea } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'

const COLOR_PICKER_COLORS = [
  '#212529', '#fa5252', '#e8590c', '#f08c00', '#2f9e44',
  '#12b886', '#1971c2', '#4dabf7', '#7950f2', '#e64980',
]

export const EditorToolbar = memo(function EditorToolbar() {
  const viewportRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.deltaY && !e.deltaX && viewportRef.current) {
      viewportRef.current.scrollLeft += e.deltaY
    }
  }, [])

  return (
    <RichTextEditor.Toolbar
      sticky
      stickyOffset={0}
      style={{
        display:    'flex',
        alignItems: 'center',
        flexWrap:   'nowrap',
        gap:        'var(--mantine-spacing-xs)',
        padding:    '4px 8px',
        overflow:   'hidden',
      }}
    >
      <ScrollArea
        offsetScrollbars="x"
        scrollbars="x"
        scrollbarSize={4}
        style={{ flex: 1, minWidth: 0 }}
        type="hover"
        viewportRef={viewportRef}
        onWheel={handleWheel}
      >
        <Group align="center" gap="xs" style={{ minWidth: 'max-content', paddingBottom: 2 }} wrap="nowrap">
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline />
            <RichTextEditor.Strikethrough /><RichTextEditor.ClearFormatting />
            <RichTextEditor.Highlight /><RichTextEditor.Code />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 /><RichTextEditor.H2 />
            <RichTextEditor.H3 /><RichTextEditor.H4 />
            <RichTextEditor.H5 /><RichTextEditor.H6 />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.ColorPicker colors={COLOR_PICKER_COLORS} />
            <RichTextEditor.UnsetColor />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList /><RichTextEditor.OrderedList />
            <RichTextEditor.TaskList /><RichTextEditor.TaskListLift /><RichTextEditor.TaskListSink />
            <RichTextEditor.Subscript /><RichTextEditor.Superscript />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link /><RichTextEditor.Unlink />
            <RichTextEditor.CodeBlock /><RichTextEditor.Hr />
            <RichTextEditor.ImageUpload />
            <RichTextEditor.TableInsert />
            <RichTextEditor.Details />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.AlignLeft /><RichTextEditor.AlignCenter />
            <RichTextEditor.AlignRight /><RichTextEditor.AlignJustify />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo /><RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </Group>
      </ScrollArea>
    </RichTextEditor.Toolbar>
  )
})
