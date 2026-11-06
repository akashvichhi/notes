/* eslint-disable @typescript-eslint/no-use-before-define -- a mutually recursive tree walk, read top-down */
import type { JSONContent } from '@tiptap/core'

import { ALIGNMENTS, IMAGE_SCHEMES, INLINE_NODES, LINK_REL, LINK_TARGET, LISTS, MARKS } from './schema'

/**
 * Makes parsed markdown valid for the editor's schema: inline runs inside block
 * containers get a paragraph, block images are lifted out of paragraphs, list
 * items start with a paragraph, cells are never empty, and attrs get the
 * editor's defaults. A port of api/app/Support/Content/DocumentNormalizer.php;
 * the one difference is that an image the editor cannot show is dropped
 * rather than rejected, because a paste must never fail.
 */

type Node = JSONContent
type Mark = NonNullable<JSONContent['marks']>[number]

const isNode = (n: unknown): n is Node => typeof n === 'object' && n !== null && typeof (n as Node).type === 'string'

export function normalizeDoc(doc: Node): Node {
  return { type: 'doc', content: blocks(doc.content ?? []) }
}

/** Any mix of nodes → a list of valid block nodes. */
function blocks(children: unknown[]): Node[] {
  const out: Node[] = []
  let inlineRun: Node[] = []

  const flush = () => {
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
function block(node: Node): Node[] {
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
    const img = image(node)
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

function blocksOrEmpty(children: unknown[]): Node[] {
  const out = blocks(children)
  return out.length > 0 ? out : [{ type: 'paragraph' }]
}

/**
 * A paragraph or heading. Block nodes found inside (usually an image, since
 * markdown puts `![](…)` in a paragraph) split it, so this may return several.
 */
function paragraphs(node: Node): Node[] {
  const attrs: Record<string, unknown> = {}
  if (node.type === 'heading') {
    const level = Number.parseInt(String(node.attrs?.level ?? 1), 10)
    attrs.level = level >= 1 && level <= 6 ? level : 1
  }
  const align = node.attrs?.textAlign
  if (typeof align === 'string' && ALIGNMENTS.includes(align)) {
    attrs.textAlign = align
  }

  const make = (run: Node[]): Node => {
    const p: Node = { type: node.type }
    if (Object.keys(attrs).length > 0) p.attrs = { ...attrs }
    const content = inline(run)
    if (content.length > 0) p.content = content
    return p
  }

  const out: Node[] = []
  let run: Node[] = []
  let split = false

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
function inline(nodes: Node[], allowBreaks = true): Node[] {
  const out: Node[] = []

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out.push(allowBreaks ? { type: 'hardBreak' } : { type: 'text', text: ' ' })
      continue
    }

    if (node.type !== 'text' || typeof node.text !== 'string' || node.text === '') continue

    // A soft line break in markdown is a space in the editor (commonmark renders it so).
    const text: Node = { type: 'text', text: node.text.replace(/\r?\n/g, ' ') }
    const marks = cleanMarks(node.marks ?? [])
    if (marks.length > 0) text.marks = marks

    const last = out[out.length - 1]
    if (last && last.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(text.marks ?? [])) {
      last.text += text.text!
    } else {
      out.push(text)
    }
  }

  return out
}

function cleanMarks(marks: Mark[]): Mark[] {
  const byType = new Map<string, Mark>()

  for (const mark of marks) {
    const type = mark?.type
    if (!type || !(MARKS as readonly string[]).includes(type) || byType.has(type)) continue

    const attrs = (mark.attrs ?? {}) as Record<string, unknown>

    if (type === 'link') {
      const href = String(attrs.href ?? '').trim()
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
      const color = attrs.color
      if (typeof color !== 'string' || color === '') continue   // a textStyle without a colour carries nothing
      byType.set(type, { type: 'textStyle', attrs: { color } })
    } else {
      byType.set(type, { type })
    }
  }

  // The editor's code mark excludes every other mark.
  if (byType.has('code')) return [{ type: 'code' }]

  return MARKS.filter((t) => byType.has(t)).map((t) => byType.get(t)!)
}

function list(node: Node): Node[] {
  const type = node.type!
  const itemType = LISTS[type] ?? 'listItem'
  const items: Node[] = []

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

  const out: Node = { type, content: items }

  if (type === 'orderedList') {
    const start = Number.parseInt(String(node.attrs?.start ?? 1), 10)
    out.attrs = { start: Number.isFinite(start) && start >= 0 ? start : 1, type: null }
  }

  return [out]
}

function listItem(itemType: string, node: Node): Node {
  const content = blocks(node.content ?? [])

  // listItem and taskItem are "paragraph block*".
  if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' })

  const item: Node = { type: itemType }
  if (itemType === 'taskItem') {
    const checked = node.attrs?.checked
    item.attrs = { checked: checked === true || checked === 'true' || checked === 'checked' || checked === 1 }
  }
  item.content = content

  return item
}

function codeBlock(node: Node): Node {
  let text = textOf(node)
  if (text.endsWith('\n')) text = text.slice(0, -1)

  const language = node.attrs?.language
  const out: Node = {
    type:  'codeBlock',
    attrs: { language: typeof language === 'string' && language !== '' ? language : null },
  }

  if (text !== '') out.content = [{ type: 'text', text }]

  return out
}

function textOf(node: Node): string {
  if (node.type === 'text') return String(node.text ?? '')
  if (node.type === 'hardBreak') return '\n'

  return (node.content ?? []).map((c) => (isNode(c) ? textOf(c) : '')).join('')
}

function image(node: Node): Node | null {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>
  const src = String(attrs.src ?? '').trim()

  // `note-image:N` placeholders and other schemes mean nothing in the editor.
  if (!IMAGE_SCHEMES.some((scheme) => src.toLowerCase().startsWith(scheme))) return null

  const dimension = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN
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

function table(node: Node): Node[] {
  const rows: Node[][] = []

  for (const row of node.content ?? []) {
    if (!isNode(row)) continue

    const cells: Node[] = []
    for (const c of row.type === 'tableRow' ? (row.content ?? []) : [row]) {
      if (!isNode(c)) continue
      cells.push(cell(c.type === 'tableCell' || c.type === 'tableHeader' ? c : { type: 'tableCell', content: [c] }))
    }

    if (cells.length > 0) rows.push(cells)
  }

  if (rows.length === 0) return []

  // ProseMirror tables must be rectangular.
  const span = (cells: Node[]) => cells.reduce((sum, c) => sum + (c.attrs!.colspan as number), 0)
  const width = Math.max(...rows.map(span))

  const content = rows.map((cells) => {
    const cellType = cells[0]!.type!
    for (let missing = width - span(cells); missing > 0; missing--) {
      cells.push(cell({ type: cellType }))
    }
    return { type: 'tableRow', content: cells }
  })

  return [{ type: 'table', content }]
}

function cell(node: Node): Node {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>
  const int = (v: unknown) => {
    const n = Number.parseInt(String(v ?? 1), 10)
    return Number.isFinite(n) ? Math.max(1, n) : 1
  }
  const colwidth = attrs.colwidth

  return {
    type:  node.type,
    attrs: {
      colspan:  int(attrs.colspan),
      rowspan:  int(attrs.rowspan),
      colwidth: Array.isArray(colwidth) ? colwidth.map((w) => Number.parseInt(String(w), 10) || 0) : null,
    },
    content: blocksOrEmpty(node.content ?? []),
  }
}

function details(node: Node): Node {
  let summary: Node[] = []
  let haveSummary = false
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

  const summaryNode: Node = { type: 'detailsSummary' }
  if (summary.length > 0) summaryNode.content = summary

  return {
    type:    'details',
    content: [summaryNode, { type: 'detailsContent', content: blocksOrEmpty(body) }],
  }
}
