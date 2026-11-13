/** Logs a caught crash once. Only the error's kind: its message may hold note text. */
export function logCrash(where: string, error: unknown): void {
  const kind: string = error instanceof Error ? error.name : typeof error
  console.error(`[crash] ${where}: ${kind}`)
}
