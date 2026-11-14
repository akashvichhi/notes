/**
 * Key case conversion at the API boundary: the API speaks snake_case, the app camelCase.
 * Only the keys of plain objects change; values, and anything that is not a plain object
 * (FormData, Blob, Date), pass through as they are.
 */

/** Keys whose value is opaque: a note body is ProseMirror JSON and must reach the editor unchanged. */
const OPAQUE_KEYS: ReadonlySet<string> = new Set<string>(['body'])

type TKeyConverter = (key: string) => string

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function convertKeys(value: unknown, convertKey: TKeyConverter): unknown {
  if (Array.isArray(value)) return value.map((item: unknown): unknown => convertKeys(item, convertKey))
  if (!isPlainObject(value)) return value

  const converted: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    converted[convertKey(key)] = OPAQUE_KEYS.has(key) ? item : convertKeys(item, convertKey)
  }
  return converted
}

/** One snake_case name in camelCase. */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match: string, letter: string): string => letter.toUpperCase())
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter: string): string => `_${letter.toLowerCase()}`)
}

export function toCamelCaseKeys(value: unknown): unknown {
  return convertKeys(value, snakeToCamel)
}

export function toSnakeCaseKeys(value: unknown): unknown {
  return convertKeys(value, camelToSnake)
}
