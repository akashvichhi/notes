/**
 * Shown when even the providers fail, so it uses plain HTML and inline
 * styles only: Mantine may be what broke.
 */
export function RootErrorFallback(): React.JSX.Element {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', margin: '0 auto', maxWidth: '28rem', padding: '3rem 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.25rem' }}>Something went wrong</h1>
      <p>The app could not start. Your notes are safe.</p>
      <a href="/">Reload</a>
    </main>
  )
}
