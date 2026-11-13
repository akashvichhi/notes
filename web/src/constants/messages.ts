type TMessageKey =
  | 'SYNC_CHANGE_REJECTED'
  | 'CRASH_TITLE'
  | 'CRASH_PAGE'
  | 'CRASH_APP'
  | 'CRASH_EDITOR'
  | 'NEW_RELEASE_TITLE'
  | 'NEW_RELEASE_BODY'
  | 'UNEXPECTED_ERROR'

/** User-facing texts that are not tied to one component. */
export const MESSAGES: Readonly<Record<TMessageKey, string>> = {
  SYNC_CHANGE_REJECTED: 'Some changes could not be saved to the cloud. They are still on this device.',
  CRASH_TITLE:          'Something went wrong',
  CRASH_PAGE:           'This part of the app stopped working. Your notes are safe.',
  CRASH_APP:            'The app stopped working. Your notes are safe; reload to continue.',
  CRASH_EDITOR:         'This note could not be shown. Your other notes are safe.',
  NEW_RELEASE_TITLE:    'A new version is available',
  NEW_RELEASE_BODY:     'Reload to start using it.',
  UNEXPECTED_ERROR:     'Something went wrong. If it keeps happening, reload the app.',
} as const
