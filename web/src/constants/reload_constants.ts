/** sessionStorage key holding when the app last reloaded to pick up a new release. */
export const RELEASE_RELOAD_KEY: string = 'release_reload_at'

/** A second stale-chunk failure within this window means reloading didn't help, so stop. */
export const RELEASE_RELOAD_WINDOW_MS: number = 10_000

/** At most one generic "something went wrong" notification in this window. */
export const UNEXPECTED_ERROR_TOAST_WINDOW_MS: number = 10_000
