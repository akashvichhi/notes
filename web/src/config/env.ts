/**
 * The only file that reads import.meta.env. VITE_* values are built into the
 * JavaScript and readable by anyone: never put a secret in one.
 */

/** True in the Vite dev server. */
export const IS_DEV: boolean = import.meta.env.DEV

/** The API server's origin, without a trailing slash; empty when the app is served by the API itself. */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
