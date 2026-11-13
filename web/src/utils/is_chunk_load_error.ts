const CHUNK_ERROR_MESSAGES: readonly string[] = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
]

/** True when a lazy route's file couldn't be loaded, usually after a new release. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'ChunkLoadError'
    || CHUNK_ERROR_MESSAGES.some((text: string): boolean => error.message.includes(text))
}
