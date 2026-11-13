import { useEffect } from 'react'

import { MESSAGES } from '@src/constants/messages'
import { UNEXPECTED_ERROR_TOAST_WINDOW_MS } from '@src/constants/reload_constants'
import { isChunkLoadError } from '@src/utils/is_chunk_load_error'
import { logCrash } from '@src/utils/log_crash'
import { showErrorToast } from '@src/utils/notifications'

const TOAST_ID: string = 'unexpected-error'

/** Browser noise that says nothing about our code. */
const IGNORED_MESSAGES: readonly string[] = ['ResizeObserver loop']

function isIgnored(error: unknown, message: string): boolean {
  return isChunkLoadError(error) || IGNORED_MESSAGES.some((text: string): boolean => message.includes(text))
}

/** Errors no boundary catches (event handlers, promises): log them and tell the user once. */
export function useGlobalErrorListener(): void {
  useEffect((): (() => void) => {
    let lastToastAt: number = 0

    const report: (error: unknown, message: string) => void = (error: unknown, message: string): void => {
      if (isIgnored(error, message)) return
      logCrash('global', error)

      const now: number = Date.now()
      if (now - lastToastAt < UNEXPECTED_ERROR_TOAST_WINDOW_MS) return
      lastToastAt = now
      showErrorToast(MESSAGES.UNEXPECTED_ERROR, TOAST_ID)
    }

    const onError: (event: ErrorEvent) => void = (event: ErrorEvent): void => report(event.error, event.message)
    const onRejection: (event: PromiseRejectionEvent) => void = (event: PromiseRejectionEvent): void => {
      const reason: unknown = event.reason
      report(reason, reason instanceof Error ? reason.message : '')
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return (): void => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}
