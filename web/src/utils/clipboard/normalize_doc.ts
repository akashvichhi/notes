/* eslint-disable @typescript-eslint/no-use-before-define -- a mutually recursive tree walk, read top-down */
import type { JSONContent } from '@tiptap/core'

import { ALIGNMENTS, IMAGE_SCHEMES, INLINE_NODES, LINK_REL, LINK_TARGET, LISTS, MARKS } from './editor_schema'

/**
 * Makes parsed markdown valid for the editor's schema: inline runs inside block
 * containers get a paragraph, block images are lifted out of paragraphs, list
 * items start with a paragraph, cells are never empty, and attrs get the
 * editor's defaults. A port of api/app/content/document_normalizer.py;
 * the one difference is that an image the editor cannot show is dropped
 * rather than rejected, because a paste must never fail.
 */

type TNode = JSONContent
type TMark = NonNullable<JSONContent['marks']>[number]

const isNode: (n: unknown) => n is TNode = (n: unknown): n is TNode => typeof n === 'object' && n !== null && typeof (n as TNode).type === 'string'

export function normalizeDoc(doc: TNode): TNode {
  return { type: 'doc', content: blocks(doc.content ?? []) }
}

/** Any mix of nodes → a list of valid block nodes. */
function blocks(children: unknown[]): TNode[] {
  const out: TNode[] = []
  let inlineRun: TNode[] = []

  const flush: () => void = (): void => {
    if (inlineRun.length > 0) {
      out.push(...paragraphs({ type: 'paragraph', content: inlineRun }))
      inlineRun = []
    }
  }

  for (const child of children) {
    if (!isNode(child)) continue

    if (INLINE_NODES.includes(child.type!)) {
      inlineRun.push(child)
      continue
    }

    flush()
    out.push(...block(child))
  }

  flush()

  return out
}

/** Zero or more block nodes. */
function block(node: TNode): TNode[] {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return paragraphs(node)
    case 'blockquote':
      return [{ type: 'blockquote', content: blocksOrEmpty(node.content ?? []) }]
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return list(node)
    case 'codeBlock':
      return [codeBlock(node)]
    case 'horizontalRule':
      return [{ type: 'horizontalRule' }]
    case 'image': {
      const img: JSONContent | null = image(node)
      return img ? [img] : []
    }
    case 'table':
      return table(node)
    case 'details':
      return [details(node)]
    case 'detailsSummary':
      return paragraphs({ type: 'paragraph', content: node.content ?? [] })
    default:
    // Misplaced structure (a bare list item, row or cell): keep what is inside it.
      return blocks(node.content ?? [])
  }
}

function blocksOrEmpty(children: unknown[]): TNode[] {
  const out: JSONContent[] = blocks(children)
  return out.length > 0 ? out : [{ type: 'paragraph' }]
}

/**
 * A paragraph or heading. Block nodes found inside (usually an image, since
 * markdown puts `![](…)` in a paragraph) split it, so this may return several.
 */
function paragraphs(node: TNode): TNode[] {
  const attrs: Record<string, unknown> = {}
  if (node.type === 'heading') {
    const level: number = Number.parseInt(String(node.attrs?.level ?? 1), 10)
    attrs.level = level >= 1 && level <= 6 ? level : 1
  }
  const align: unknown = node.attrs?.textAlign
  if (typeof align === 'string' && ALIGNMENTS.includes(align)) {
    attrs.textAlign = align
  }

  const make: (run: TNode[]) => TNode = (run: TNode[]): TNode => {
    const p: TNode = { type: node.type }
    if (Object.keys(attrs).length > 0) p.attrs = { ...attrs }
    const content: JSONContent[] = inline(run)
    if (content.length > 0) p.content = content
    return p
  }

  const out: TNode[] = []
  let run: TNode[] = []
  let split: boolean = false

  for (const child of node.content ?? []) {
    if (!isNode(child)) continue

    if (INLINE_NODES.includes(child.type!)) {
      run.push(child)
      continue
    }

    split = true
    if (inline(run).length > 0) out.push(make(run))
    run = []
    out.push(...block(child))
  }

  if (!split || inline(run).length > 0) out.push(make(run))

  return out
}

/** Text and hard breaks with clean marks; adjacent text with equal marks merged. */
function inline(nodes: TNode[], allowBreaks: boolean = true): TNode[] {
  const out: TNode[] = []

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out.push(allowBreaks ? { type: 'hardBreak' } : { type: 'text', text: ' ' })
      continue
    }

    if (node.type !== 'text' || typeof node.text !== 'string' || node.text === '') continue

    // A soft line break in markdown is a space in the editor (commonmark renders it so).
    const text: TNode = { type: 'text', text: node.text.replace(/\r?\n/g, ' ') }
    const marks: TMark[] = cleanMarks(node.marks ?? [])
    if (marks.length > 0) text.marks = marks

    const last: JSONContent | undefined = out[out.length - 1]
    if (last && last.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(text.marks ?? [])) {
      last.text += text.text!
    } else {
      out.push(text)
    }
  }

  return out
}

function cleanMarks(marks: TMark[]): TMark[] {
  const byType: Map<string, TMark> = new Map<string, TMark>()

  for (const mark of marks) {
    const type: string = mark?.type
    if (!type || !(MARKS as readonly string[]).includes(type) || byType.has(type)) continue

    const attrs: Record<string, unknown> = (mark.attrs ?? {}) as Record<string, unknown>

    if (type === 'link') {
      const href: string = String(attrs.href ?? '').trim()
      if (href === '') continue
      byType.set(type, {
        type:  'link',
        attrs: {
          href,
          target: attrs.target ?? LINK_TARGET,
          rel:    attrs.rel ?? LINK_REL,
          class:  attrs.class ?? null,
        },
      })
    } else if (type === 'textStyle') {
      const color: unknown = attrs.color
      if (typeof color !== 'string' || color === '') continue   // a textStyle without a colour carries nothing
      byType.set(type, { type: 'textStyle', attrs: { color } })
    } else {
      byType.set(type, { type })
    }
  }

  // The editor's code mark excludes every other mark.
  if (byType.has('code')) return [{ type: 'code' }]

  return MARKS.filter((t: 'code' | 'link' | 'bold' | 'strike' | 'italic' | 'underline' | 'textStyle' | 'highlight' | 'subscript' | 'superscript') => byType.has(t)).map((t: 'code' | 'link' | 'bold' | 'strike' | 'italic' | 'underline' | 'textStyle' | 'highlight' | 'subscript' | 'superscript') => byType.get(t)!)
}

function list(node: TNode): TNode[] {
  const type: string = node.type!
  const itemType: 'listItem' | 'taskItem' = LISTS[type] ?? 'listItem'
  const items: TNode[] = []

  for (const child of node.content ?? []) {
    if (!isNode(child)) continue

    if (child.type === 'listItem' || child.type === 'taskItem') {
      items.push(listItem(itemType, child))
    } else if (LISTS[child.type!] && items.length > 0) {
      // A list directly inside a list belongs to the item before it.
      items[items.length - 1]!.content!.push(...block(child))
    } else {
      items.push(listItem(itemType, { type: itemType, content: [child] }))
    }
  }

  if (items.length === 0) return []

  const out: TNode = { type, content: items }

  if (type === 'orderedList') {
    const start: number = Number.parseInt(String(node.attrs?.start ?? 1), 10)
    out.attrs = { start: Number.isFinite(start) && start >= 0 ? start : 1, type: null }
  }

  return [out]
}

function listItem(itemType: string, node: TNode): TNode {
  const content: JSONContent[] = blocks(node.content ?? [])

  // listItem and taskItem are "paragraph block*".
  if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' })

  const item: TNode = { type: itemType }
  if (itemType === 'taskItem') {
    const checked: unknown = node.attrs?.checked
    item.attrs = { checked: checked === true || checked === 'true' || checked === 'checked' || checked === 1 }
  }
  item.content = content

  return item
}

function codeBlock(node: TNode): TNode {
  let text: string = textOf(node)
  if (text.endsWith('\n')) text = text.slice(0, -1)

  const language: unknown = node.attrs?.language
  const out: TNode = {
    type:  'codeBlock',
    attrs: { language: typeof language === 'string' && language !== '' ? language : null },
  }

  if (text !== '') out.content = [{ type: 'text', text }]

  return out
}

function textOf(node: TNode): string {
  if (node.type === 'text') return String(node.text ?? '')
  if (node.type === 'hardBreak') return '\n'

  return (node.content ?? []).map((c: JSONContent) => (isNode(c) ? textOf(c) : '')).join('')
}

function image(node: TNode): TNode | null {
  const attrs: Record<string, unknown> = (node.attrs ?? {}) as Record<string, unknown>
  const src: string = String(attrs.src ?? '').trim()

  // `note-image:N` placeholders and other schemes mean nothing in the editor.
  if (!IMAGE_SCHEMES.some((scheme: string) => src.toLowerCase().startsWith(scheme))) return null

  const dimension: (v: unknown) => number | null = (v: unknown): number | null => {
    const n: number = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN
    return Number.isFinite(n) ? Math.trunc(n) : null
  }

  return {
    type:  'image',
    attrs: {
      src,
      alt:    typeof attrs.alt === 'string' && attrs.alt !== '' ? attrs.alt : null,
      title:  typeof attrs.title === 'string' && attrs.title !== '' ? attrs.title : null,
      width:  dimension(attrs.width),
      height: dimension(attrs.height),
    },
  }
}

function table(node: TNode): TNode[] {
  const rows: TNode[][] = []

  for (const row of node.content ?? []) {
    if (!isNode(row)) continue

    const cells: TNode[] = []
    for (const c of row.type === 'tableRow' ? (row.content ?? []) : [row]) {
      if (!isNode(c)) continue
      cells.push(cell(c.type === 'tableCell' || c.type === 'tableHeader' ? c : { type: 'tableCell', content: [c] }))
    }

    if (cells.length > 0) rows.push(cells)
  }

  if (rows.length === 0) return []

  // ProseMirror tables must be rectangular.
  const span: (cells: TNode[]) => number = (cells: TNode[]): number => cells.reduce((sum: number, c: JSONContent) => sum + (c.attrs!.colspan as number), 0)
  const width: number = Math.max(...rows.map(span))

  const content: { type: string; content: JSONContent[]; }[] = rows.map((cells: JSONContent[]) => {
    const cellType: string = cells[0]!.type!
    for (let missing: number = width - span(cells); missing > 0; missing--) {
      cells.push(cell({ type: cellType }))
    }
    return { type: 'tableRow', content: cells }
  })

  return [{ type: 'table', content }]
}

function cell(node: TNode): TNode {
  const attrs: Record<string, unknown> = (node.attrs ?? {}) as Record<string, unknown>
  const int: (v: unknown) => number = (v: unknown): number => {
    const n: number = Number.parseInt(String(v ?? 1), 10)
    return Number.isFinite(n) ? Math.max(1, n) : 1
  }
  const colwidth: unknown = attrs.colwidth

  return {
    type:  node.type,
    attrs: {
      colspan:  int(attrs.colspan),
      rowspan:  int(attrs.rowspan),
      colwidth: Array.isArray(colwidth) ? colwidth.map((w: unknown): number => Number.parseInt(String(w), 10) || 0) : null,
    },
    content: blocksOrEmpty(node.content ?? []),
  }
}

function details(node: TNode): TNode {
  let summary: TNode[] = []
  let haveSummary: boolean = false
  const body: unknown[] = []

  for (const child of node.content ?? []) {
    if (!isNode(child)) continue
    if (child.type === 'detailsSummary' && !haveSummary) {
      summary = inline(child.content ?? [], false)
      haveSummary = summary.length > 0
    } else if (child.type === 'detailsContent') {
      body.push(...(child.content ?? []))
    } else {
      body.push(child)
    }
  }

  const summaryNode: TNode = { type: 'detailsSummary' }
  if (summary.length > 0) summaryNode.content = summary

  return {
    type:    'details',
    content: [summaryNode, { type: 'detailsContent', content: blocksOrEmpty(body) }],
  }
}
