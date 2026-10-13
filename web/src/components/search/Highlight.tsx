import { Fragment, memo, useMemo } from 'react'

/**
 * The API returns plain text plus the matched terms, never HTML. Highlighting
 * happens here, as React nodes, so note content can never become markup.
 */
export const HighlightTerms = memo(function HighlightTerms({
  text,
  terms,
}: {
  text: string
  terms: string[]
}) {
  const parts = useMemo(() => {
    if (terms.length === 0) return null
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return text.split(new RegExp(`(${escaped.join('|')})`, 'ig'))
  }, [text, terms])

  const termsSet = useMemo(() => new Set(terms.map((t) => t.toLowerCase())), [terms])

  if (!parts) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        termsSet.has(part.toLowerCase()) ? (
          <mark key={i}>{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
})
