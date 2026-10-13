import { useEffect, useState } from 'react'

/**
 * Most requests return in under 100ms. Showing a spinner for one frame makes a
 * fast app feel broken, so nothing is shown until loading outlasts `delayMs`.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 250): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      const id = requestAnimationFrame(() => setShow(false))
      return () => cancelAnimationFrame(id)
    }

    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [isLoading, delayMs])

  return isLoading && show
}
