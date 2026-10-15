import { memo, useEffect, useMemo } from 'react'

import { Box } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'

import { ConflictSheet } from '@/components/common/ConflictSheet'
import { useAutosave } from '@/hooks/useAutosave'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useKeyboardInset } from '@/hooks/useVisualViewport'
import { sanitizeProseMirrorDoc } from '@/lib/prosemirror'
import { useUiStore } from '@/stores/uiStore'
import type { Note } from '@/types/api'

import { EditorToolbar } from './EditorToolbar'
import { editorExtensions } from './extensions'
import mobile from './mobile.module.css'
import { TableBar } from './TableBar'
import { TagStrip } from './TagStrip'

export const Editor = memo(function Editor({ note }: { note: Note }) {
  const isPhone = useIsPhone()
  const keyboardInset = useKeyboardInset()
  const setEditorStats = useUiStore((s) => s.setEditorStats)

  const sanitizedContent = useMemo(() => {
    return sanitizeProseMirrorDoc(note.body)
  }, [note.body])

  const editor = useEditor(
    {
      extensions:  editorExtensions,
      content:     sanitizedContent,
      // ProseMirror's schema is a strict whitelist; anything unrecognised is dropped.
      editorProps: {
        attributes: { 'aria-label': 'Note body' },
      },
    },
    [note.uuid],
  )

  // Keep editor content in sync when note body changes externally or finishes loading
  useEffect(() => {
    if (!editor) return
    const currentJson = JSON.stringify(editor.getJSON())
    const nextJson = JSON.stringify(sanitizedContent)
    if (currentJson !== nextJson) {
      editor.commands.setContent(sanitizedContent, { emitUpdate: false })
    }
  }, [editor, sanitizedContent])

  // Track live word count, character count, and selected count
  useEffect(() => {
    if (!editor) return

    const updateStats = () => {
      const words = editor.storage.characterCount?.words() ?? 0
      const characters = editor.storage.characterCount?.characters() ?? 0
      const { from, to, empty } = editor.state.selection
      let selectedWords = 0
      let selectedCharacters = 0
      if (!empty) {
        const text = editor.state.doc.textBetween(from, to, ' ')
        selectedCharacters = text.length
        const trimmed = text.trim()
        selectedWords = trimmed ? trimmed.split(/\s+/).length : 0
      }
      setEditorStats({
        words,
        characters,
        selectedWords,
        selectedCharacters,
      })
    }

    updateStats()
    editor.on('transaction', updateStats)
    return () => {
      editor.off('transaction', updateStats)
      setEditorStats(null)
    }
  }, [editor, setEditorStats])

  const {
    onChange,
    conflict,
    clearConflict,
    resolveKeepMine,
    resolveKeepTheirs,
    resolveSaveCopy,
  } = useAutosave(note, editor)

  useEffect(() => {
    if (!editor) return
    editor.on('update', onChange)
    return () => { editor.off('update', onChange) }
  }, [editor, onChange])

  return (
    <Box className={mobile.editorRoot} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {conflict && (
        <ConflictSheet
          serverCopy={conflict}
          onClose={clearConflict}
          onKeepMine={resolveKeepMine}
          onKeepTheirs={resolveKeepTheirs}
          onSaveCopy={resolveSaveCopy}
        />
      )}
      <RichTextEditor editor={editor} style={{ display: 'contents' }}>
        <Box className={mobile.toolbar} style={{ transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined }}>
          <EditorToolbar />
        </Box>
        <TableBar editor={editor} />

        {/* The bubble menu collides with iOS selection handles. */}
        {!isPhone && editor && (
          <BubbleMenu editor={editor}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline />
              <RichTextEditor.Strikethrough /><RichTextEditor.Highlight /><RichTextEditor.Link />
              <RichTextEditor.H2 />
            </RichTextEditor.ControlsGroup>
          </BubbleMenu>
        )}

        <Box className={mobile.content} px={{ base: 12, sm: 16 }} py="md" style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
          <TagStrip note={note} />
          {/* Full width: no max-width column. */}
          <RichTextEditor.Content />
        </Box>
      </RichTextEditor>
    </Box>
  )
})
