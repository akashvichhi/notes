import type { TUuid } from '@src/types/api'

/** Which notes the list shows. It lives in the URL (`routes/scope_location.ts`). */
export type TScope =
  | { kind: 'all' }
  | { kind: 'starred' }
  | { kind: 'trash' }
  | { kind: 'folder'; uuid: TUuid }
  | { kind: 'tag'; slug: string }
  | { kind: 'search'; q: string }
