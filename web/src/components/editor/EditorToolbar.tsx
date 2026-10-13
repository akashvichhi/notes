import { RichTextEditor, useRichTextEditorContext } from '@mantine/tiptap'
import { SegmentedControl } from '@mantine/core'
import { IconTable } from '@tabler/icons-react'

import { useIsPhone } from '../layout/AppShell'

export function EditorToolbar({ mode, onMode }: { mode: 'rich' | 'source'; onMode: (m: 'rich' | 'source') => void }) {
  const { editor } = useRichTextEditorContext()
  const isPhone = useIsPhone()

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
        <RichTextEditor.ColorPicker
          colors={['#212529', '#fa5252', '#e8590c', '#f08c00', '#2f9e44',
                   '#12b886', '#1971c2', '#4dabf7', '#7950f2', '#e64980']}
        />
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
          aria-label="Insert table" title="Insert table"
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
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
          ml="auto" size="xs" value={mode}
          onChange={(v) => onMode(v as 'rich' | 'source')}
          data={[{ label: 'Rich text', value: 'rich' }, { label: 'Source', value: 'source' }]}
        />
      )}
    </RichTextEditor.Toolbar>
  )
}
