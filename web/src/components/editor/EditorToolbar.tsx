import { SegmentedControl } from '@mantine/core'
import { RichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import { IconTable } from '@tabler/icons-react'

import { memo, useCallback } from 'react'

import { useIsPhone } from '@/hooks/useIsPhone'

const COLOR_PICKER_COLORS = [
  '#212529', '#fa5252', '#e8590c', '#f08c00', '#2f9e44',
  '#12b886', '#1971c2', '#4dabf7', '#7950f2', '#e64980',
]

const MODE_OPTIONS = [
  { label: 'Rich text', value: 'rich' },
  { label: 'Source', value: 'source' },
]

export const EditorToolbar = memo(function EditorToolbar({
  mode,
  onMode,
}: {
  mode: 'rich' | 'source'
  onMode: (m: 'rich' | 'source') => void
}) {
  const { editor } = useRichTextEditorContext()
  const isPhone = useIsPhone()

  const handleInsertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const handleModeChange = useCallback(
    (v: string) => {
      onMode(v as 'rich' | 'source')
    },
    [onMode],
  )

  return (
    <RichTextEditor.Toolbar sticky stickyOffset={0}>
      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline />
        <RichTextEditor.Strikethrough /><RichTextEditor.ClearFormatting />
        <RichTextEditor.Highlight /><RichTextEditor.Code />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.H1 /><RichTextEditor.H2 />
        <RichTextEditor.H3 /><RichTextEditor.H4 />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.ColorPicker colors={COLOR_PICKER_COLORS} />
        <RichTextEditor.UnsetColor />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.BulletList /><RichTextEditor.OrderedList />
        <RichTextEditor.TaskList /><RichTextEditor.Blockquote />
        <RichTextEditor.Subscript /><RichTextEditor.Superscript />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Link /><RichTextEditor.Unlink />
        <RichTextEditor.CodeBlock /><RichTextEditor.Hr />
        <RichTextEditor.Control
          aria-label="Insert table"
          title="Insert table"
          onClick={handleInsertTable}
        >
          <IconTable size={16} />
        </RichTextEditor.Control>
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.AlignLeft /><RichTextEditor.AlignCenter />
        <RichTextEditor.AlignRight /><RichTextEditor.AlignJustify />
      </RichTextEditor.ControlsGroup>

      <RichTextEditor.ControlsGroup>
        <RichTextEditor.Undo /><RichTextEditor.Redo />
      </RichTextEditor.ControlsGroup>

      {!isPhone && (
        <SegmentedControl
          data={MODE_OPTIONS}
          ml="auto"
          size="xs"
          value={mode}
          onChange={handleModeChange}
        />
      )}
    </RichTextEditor.Toolbar>
  )
})
