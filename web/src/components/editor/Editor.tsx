import { RichTextEditor } from '@mantine/tiptap'
import { Box } from '@mantine/core'
import { BubbleMenu, useEditor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { useIsPhone } from '../layout/AppShell'
import { EditorToolbar } from './EditorToolbar'
import { TableBar } from './TableBar'
import { TagStrip } from './TagStrip'
import { editorExtensions } from './extensions'
import { useAutosave } from '@/hooks/useAutosave'
import type { Note } from '@/types/api'

export function Editor({ note }: { note: Note }) {
  const isPhone = useIsPhone()
  const [mode, setMode] = useState<'rich' | 'source'>('rich')

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: note.body ?? { type: 'doc', content: [] },
      // ProseMirror's schema is a strict whitelist; anything unrecognised is dropped.
      editorProps: { attributes: { 'aria-label': 'Note body' } },
    },
    [note.uuid],
  )

  const { onChange } = useAutosave(note, editor)

  useEffect(() => {
    if (!editor) return
    editor.on('update', onChange)
    return () => { editor.off('update', onChange) }
  }, [editor, onChange])

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <RichTextEditor editor={editor} style={{ display: 'contents' }}>
        <EditorToolbar mode={mode} onMode={setMode} />
        <TableBar editor={editor} />

        {/* The bubble menu collides with iOS selection handles. */}
        {!isPhone && editor && (
          <BubbleMenu editor={editor}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold /><RichTextEditor.Italic />
              <RichTextEditor.Strikethrough /><RichTextEditor.Link />
              <RichTextEditor.H2 />
            </RichTextEditor.ControlsGroup>
          </BubbleMenu>
        )}

        <Box style={{ overflowY: 'auto', minHeight: 0, flex: 1 }} px={{ base: 16, sm: 28, lg: 48 }} py="lg">
          <TagStrip note={note} />
          {/* Full width: no max-width column. */}
          <RichTextEditor.Content />
        </Box>
      </RichTextEditor>
    </Box>
  )
}
