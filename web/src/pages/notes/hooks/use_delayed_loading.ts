import { useEffect, useState } from 'react'

/**
 * Most requests return in under 100ms. Showing a spinner for one frame makes a
 * fast app feel broken, so nothing is shown until loading outlasts `delayMs`.
 */
export function useDelayedLoading(isLoading: boolean, delayMs: number = 250): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      const id: number = requestAnimationFrame(() => setShow(false))
      return (): void => cancelAnimationFrame(id)
    }

    const t: number = setTimeout(() => setShow(true), delayMs)
    return (): void => clearTimeout(t)
  }, [isLoading, delayMs])

  return isLoading && show
}
