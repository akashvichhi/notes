import { Fragment } from 'react'

/**
 * The API returns plain text plus the matched terms, never HTML. Highlighting
 * happens here, as React nodes, so note content can never become markup.
 */
export function HighlightTerms({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'ig'))

  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase())
          ? <mark key={i}>{part}</mark>
          : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}
