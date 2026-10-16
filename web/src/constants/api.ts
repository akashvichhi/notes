/**
 * Single source of truth for the production domain and endpoints.
 */
export const PRODUCTION_DOMAIN = 'notes.codespan.in'
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_DOMAIN}`
export const PRODUCTION_URL = PRODUCTION_ORIGIN
export const PRODUCTION_API_URL = `${PRODUCTION_ORIGIN}/api/v1`

/**
 * Single source of truth for native (desktop & mobile) applications.
 * Used in both development and production builds.
 */
export const NATIVE_API_BASE_URL = PRODUCTION_API_URL
