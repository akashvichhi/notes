import { useEffect, useState } from 'react'

/**
 * A sticky bottom toolbar still gets covered by the keyboard on iOS Safari.
 * The visualViewport API is the only reliable way to know how much is hidden.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => setInset(Math.max(0, window.innerHeight - vv.height))

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
