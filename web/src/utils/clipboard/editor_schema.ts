/**
 * The node and mark names of the editor's schema (extensions.ts), as the
 * markdown converter needs them. Mirrors api-laravel/app/Support/Content/EditorSchema.php:
 * keep the two in step.
 */

export const LISTS: Record<string, 'listItem' | 'taskItem'> = {
  bulletList:  'listItem',
  orderedList: 'listItem',
  taskList:    'taskItem',
}

export const INLINE_NODES: string[] = ['text', 'hardBreak']

/** Canonical order, outermost first: markdown delimiters wrap the HTML tags. */
export const MARKS: readonly ['link', 'bold', 'italic', 'strike', 'underline', 'highlight', 'textStyle', 'subscript', 'superscript', 'code'] = [
  'link', 'bold', 'italic', 'strike', 'underline', 'highlight', 'textStyle', 'subscript', 'superscript', 'code',
] as const

export const ALIGNMENTS: string[] = ['left', 'center', 'right', 'justify']

/** The editor's Link defaults (Mantine's Link extends Tiptap's). */
export const LINK_TARGET: string = '_blank'
export const LINK_REL: string = 'noopener noreferrer nofollow'

export const IMAGE_SCHEMES: string[] = ['http://', 'https://', 'data:image/']

/** Pasted images live in the body as data URLs; markdown for the MCP uses `note-image:N`. */
export const NOTE_IMAGE_SCHEME: string = 'note-image:'

export const isEmbeddedImage: (src: unknown) => src is string = (src: unknown): src is string => typeof src === 'string' && src.startsWith('data:')
