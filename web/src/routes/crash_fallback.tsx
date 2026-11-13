import { MESSAGES } from '@src/constants/messages'
import { ErrorFallback } from '@src/ui/feedback/error_fallback'
import { isChunkLoadError } from '@src/utils/is_chunk_load_error'

export interface ICrashFallbackProps {
  error:   unknown
  /** Renders the area again; a stale release is fixed by reloading instead. */
  onRetry: () => void
}

function reloadPage(): void {
  window.location.reload()
}

/** What a route shows after it crashed. Never the error itself. */
export function CrashFallback({ error, onRetry }: ICrashFallbackProps): React.JSX.Element {
  if (isChunkLoadError(error)) {
    return (
      <ErrorFallback
        actionLabel="Reload"
        message={MESSAGES.NEW_RELEASE_BODY}
        title={MESSAGES.NEW_RELEASE_TITLE}
        onAction={reloadPage}
      />
    )
  }

  return <ErrorFallback actionLabel="Try again" message={MESSAGES.CRASH_PAGE} title={MESSAGES.CRASH_TITLE} onAction={onRetry} />
}
