import { Fragment, memo, useMemo } from 'react'

/**
 * The API returns plain text plus the matched terms, never HTML. Highlighting
 * happens here, as React nodes, so note content can never become markup.
 */
export const HighlightTerms: React.MemoExoticComponent<({ text, terms, }: { text: string; terms: string[]; }) => React.JSX.Element> = memo(function HighlightTerms({
  text,
  terms,
}: {
  text:  string
  terms: string[]
}) {
  const parts: string[] | null = useMemo(() => {
    if (terms.length === 0) return null
    const escaped: string[] = terms.map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return text.split(new RegExp(`(${escaped.join('|')})`, 'ig'))
  }, [text, terms])

  const termsSet: Set<string> = useMemo(() => new Set(terms.map((t: string) => t.toLowerCase())), [terms])

  if (!parts) return <>{text}</>

  return (
    <>
      {parts.map((part: string, i: number) =>
        termsSet.has(part.toLowerCase()) ? (
          <mark key={i}>{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
})
