import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Color from '@tiptap/extension-color'
import Details from '@tiptap/extension-details'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import InvisibleCharacters from '@tiptap/extension-invisible-characters'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'

/**
 * Every extension here is MIT. Do not add @tiptap-pro/* — the project has no
 * TipTap Pro licence, and nothing in Phase 1 needs one.
 */
export const editorExtensions = [
  StarterKit.configure({ codeBlock: false }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true }),
  Highlight,
  TextStyle,
  Color,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  // Merged cells cannot be represented if a markdown export is ever added,
  // and node selection is what exposes merging in the UI.
  Table.configure({ resizable: true, allowTableNodeSelection: false }),
  TableRow,
  TableHeader,
  TableCell,
  Image,
  Details,
  InvisibleCharacters.configure({ visible: false }),
  CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
  Typography,
  CharacterCount,
  Placeholder.configure({ placeholder: 'Start writing…' }),
]
