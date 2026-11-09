import type { SyntheticEvent } from 'react'

export function stopEventPropagation(e: SyntheticEvent): void {
  e.stopPropagation()
}
