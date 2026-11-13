import type { ReactNode } from 'react'

import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

import { MESSAGES } from '@src/constants/messages'
import type { UUID } from '@src/types/api'
import { ErrorFallback } from '@src/ui/feedback/error_fallback'
import { logCrash } from '@src/utils/log_crash'

export interface IEditorBoundaryProps {
  noteUuid: UUID
  children: ReactNode
}

function renderFallback({ resetErrorBoundary }: FallbackProps): React.JSX.Element {
  return (
    <ErrorFallback
      actionLabel={MESSAGES.TRY_AGAIN_ACTION}
      message={MESSAGES.CRASH_EDITOR}
      title={MESSAGES.CRASH_TITLE}
      onAction={resetErrorBoundary}
    />
  )
}

function handleError(error: unknown): void {
  logCrash('editor', error)
}

/** A note body the editor can't render must not take the list and sidebar down with it. */
export function EditorBoundary({ noteUuid, children }: IEditorBoundaryProps): React.JSX.Element {
  return (
    <ErrorBoundary fallbackRender={renderFallback} resetKeys={[noteUuid]} onError={handleError}>
      {children}
    </ErrorBoundary>
  )
}
