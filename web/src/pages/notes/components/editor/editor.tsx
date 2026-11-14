import { memo, useEffect, useMemo } from 'react'

import { Box } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { type Editor as TiptapEditor, type JSONContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'


import { useIsPhone } from '@src/hooks/use_is_phone'
import { useAutosave } from '@src/pages/notes/hooks/use_autosave'
import { useKeyboardInset } from '@src/pages/notes/hooks/use_visual_viewport'
import { useUiStore } from '@src/stores/ui_store'
import type { IEditorStats, IUiState } from '@src/stores/ui_store'
import type { INote } from '@src/types/api'
import { sanitizeProseMirrorDoc } from '@src/utils/prosemirror'

import { ConflictSheet } from './conflict_sheet'
import mobile from './editor.module.scss'
import { editorExtensions } from './editor_extensions'
import { EditorToolbar } from './editor_toolbar'
import { TableBar } from './table_bar'
import { TagStrip } from './tag_strip'


export const Editor: React.MemoExoticComponent<({ note }: { note: INote; }) => React.JSX.Element> = memo(function Editor({ note }: { note: INote }) {
  const isPhone: boolean = useIsPhone()
  const keyboardInset: number = useKeyboardInset()
  const setEditorStats: (editorStats: IEditorStats | null) => void = useUiStore((s: IUiState) => s.setEditorStats)

  const sanitizedContent: JSONContent = useMemo(() => {
    return sanitizeProseMirrorDoc(note.body)
  }, [note.body])

  const editor: TiptapEditor | null = useEditor(
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
    const currentJson: string = JSON.stringify(editor.getJSON())
    const nextJson: string = JSON.stringify(sanitizedContent)
    if (currentJson !== nextJson) {
      editor.commands.setContent(sanitizedContent, { emitUpdate: false })
    }
  }, [editor, sanitizedContent])

  // Track live word count, character count, and selected count
  useEffect(() => {
    if (!editor) return

    const updateStats: () => void = (): void => {
      const words: number = editor.storage.characterCount?.words() ?? 0
      const characters: number = editor.storage.characterCount?.characters() ?? 0
      const { from, to, empty } = editor.state.selection
      let selectedWords: number = 0
      let selectedCharacters: number = 0
      if (!empty) {
        const text: string = editor.state.doc.textBetween(from, to, ' ')
        selectedCharacters = text.length
        const trimmed: string = text.trim()
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
    return (): void => {
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
    resolveRestoreMine,
    resolveDiscard,
  } = useAutosave(note, editor)

  useEffect(() => {
    if (!editor) return
    editor.on('update', onChange)
    return (): void => { editor.off('update', onChange) }
  }, [editor, onChange])

  return (
    <Box className={mobile.editorRoot} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {conflict && (
        <ConflictSheet
          serverCopy={conflict}
          onClose={clearConflict}
          onDiscard={resolveDiscard}
          onKeepMine={resolveKeepMine}
          onKeepTheirs={resolveKeepTheirs}
          onRestoreMine={resolveRestoreMine}
          onSaveCopy={resolveSaveCopy}
        />
      )}
      <RichTextEditor classNames={{ control: mobile.control }} editor={editor} style={{ display: 'contents' }}>
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
          <RichTextEditor.Content />
        </Box>
      </RichTextEditor>
    </Box>
  )
})
