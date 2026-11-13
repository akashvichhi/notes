import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library can't register its own cleanup.
afterEach((): void => {
  cleanup()
})

// jsdom has no matchMedia or ResizeObserver, which Mantine components use.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value:    (query: string): MediaQueryList => ({
    matches:             false,
    media:               query,
    onchange:            null,
    addListener:         (): void => {},
    removeListener:      (): void => {},
    addEventListener:    (): void => {},
    removeEventListener: (): void => {},
    dispatchEvent:       (): boolean => false,
  }),
})

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
window.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver
