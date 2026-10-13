import type { ProseMirrorDoc } from '@/types/api'

/**
 * Sanitizes a ProseMirror document to ensure it conforms to ProseMirror's strict schema.
 * Drops any text nodes with null, undefined, or non-string text values that would otherwise
 * cause ProseMirror to throw RangeError: "Invalid text node in JSON".
 */
export function sanitizeProseMirrorDoc(doc: unknown): ProseMirrorDoc {
  if (!doc || typeof doc !== 'object') {
    return { type: 'doc', content: [] }
  }

  const raw = doc as Record<string, unknown>
  if (raw.type !== 'doc') {
    return { type: 'doc', content: [] }
  }

  function cleanNode(node: unknown): unknown | null {
    if (!node || typeof node !== 'object') return null

    const n = node as Record<string, unknown>

    // Text nodes MUST have a string text value. Drop any invalid/null text nodes.
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || n.text.length === 0) {
        return null
      }
      return {
        ...n,
        text: n.text,
      }
    }

    // Recursively clean child content
    if (Array.isArray(n.content)) {
      const cleanedChildren: unknown[] = []
      for (const child of n.content) {
        const cleaned = cleanNode(child)
        if (cleaned) {
          cleanedChildren.push(cleaned)
        }
      }
      return {
        ...n,
        content: cleanedChildren,
      }
    }

    return n
  }

  const cleaned = cleanNode(raw) as ProseMirrorDoc
  return cleaned ?? { type: 'doc', content: [] }
}
