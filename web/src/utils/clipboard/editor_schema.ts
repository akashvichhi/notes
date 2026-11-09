/**
 * The node and mark names of the editor's schema (extensions.ts), as the
 * markdown converter needs them. Mirrors api/app/Support/Content/EditorSchema.php:
 * keep the two in step.
 */

export const LISTS: Record<string, 'listItem' | 'taskItem'> = {
  bulletList:  'listItem',
  orderedList: 'listItem',
  taskList:    'taskItem',
}

export const INLINE_NODES = ['text', 'hardBreak']

/** Canonical order, outermost first: markdown delimiters wrap the HTML tags. */
export const MARKS = [
  'link', 'bold', 'italic', 'strike', 'underline', 'highlight', 'textStyle', 'subscript', 'superscript', 'code',
] as const

export const ALIGNMENTS = ['left', 'center', 'right', 'justify']

/** The editor's Link defaults (Mantine's Link extends Tiptap's). */
export const LINK_TARGET = '_blank'
export const LINK_REL = 'noopener noreferrer nofollow'

export const IMAGE_SCHEMES = ['http://', 'https://', 'data:image/']

/** Pasted images live in the body as data URLs; markdown for the MCP uses `note-image:N`. */
export const NOTE_IMAGE_SCHEME = 'note-image:'

export const isEmbeddedImage = (src: unknown): src is string => typeof src === 'string' && src.startsWith('data:')
