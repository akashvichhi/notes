import { memo, useCallback, useEffect, useState } from 'react'

import { Box } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'


import { useAutosave } from '@/hooks/useAutosave'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useKeyboardInset } from '@/hooks/useVisualViewport'
import type { Note } from '@/types/api'

import { EditorToolbar } from './EditorToolbar'
import { editorExtensions } from './extensions'
import mobile from './mobile.module.css'
import { TableBar } from './TableBar'
import { TagStrip } from './TagStrip'

export const Editor = memo(function Editor({ note }: { note: Note }) {
  const isPhone = useIsPhone()
  const keyboardInset = useKeyboardInset()
  const [mode, setMode] = useState<'rich' | 'source'>('rich')

  const handleModeChange = useCallback((m: 'rich' | 'source') => {
    setMode(m)
  }, [])

  const editor = useEditor(
    {
      extensions:  editorExtensions,
      content:     note.body ?? { type: 'doc', content: [] },
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
    <Box className={mobile.editorRoot} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <RichTextEditor editor={editor} style={{ display: 'contents' }}>
        <Box className={mobile.toolbar} style={{ transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined }}>
          <EditorToolbar mode={mode} onMode={handleModeChange} />
        </Box>
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

        <Box className={mobile.content} px={{ base: 16, sm: 28, lg: 48 }} py="lg" style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
          <TagStrip note={note} />
          {/* Full width: no max-width column. */}
          <RichTextEditor.Content />
        </Box>
      </RichTextEditor>
    </Box>
  )
})
