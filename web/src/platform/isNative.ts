/**
 * True inside a Tauri window. Tauri 2 sets __TAURI_INTERNALS__ on window before
 * any app code runs, so this is safe to call at module scope.
 */
export function isNative(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
