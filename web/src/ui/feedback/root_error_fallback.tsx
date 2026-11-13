import { MESSAGES } from '@src/constants/messages'

/**
 * Shown when even the providers fail, so it uses plain HTML and inline
 * styles only: Mantine may be what broke.
 */
export function RootErrorFallback(): React.JSX.Element {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', margin: '0 auto', maxWidth: '28rem', padding: '3rem 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.25rem' }}>{MESSAGES.CRASH_TITLE}</h1>
      <p>{MESSAGES.CRASH_ROOT}</p>
      <a href="/">{MESSAGES.RELOAD_ACTION}</a>
    </main>
  )
}
