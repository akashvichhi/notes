type TMessageKey =
  | 'CRASH_TITLE'
  | 'CRASH_PAGE'
  | 'CRASH_APP'
  | 'CRASH_ROOT'
  | 'CRASH_EDITOR'
  | 'NEW_RELEASE_TITLE'
  | 'NEW_RELEASE_BODY'
  | 'UNEXPECTED_ERROR'
  | 'NETWORK_ERROR'
  | 'REQUEST_FAILED'
  | 'RELOAD_ACTION'
  | 'TRY_AGAIN_ACTION'
  | 'TOKEN_SCOPE_REQUIRED'
  | 'TOKEN_CREATE_FAILED'
  | 'TOKEN_REVOKE_FAILED'
  | 'ACCOUNT_UPDATED'
  | 'ACCOUNT_UPDATE_FAILED'
  | 'PASSWORDS_DIFFER'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_CHANGE_FAILED'
  | 'COPY_SAVED'
  | 'COPY_SAVE_FAILED'
  | 'REFRESH_OFFLINE'
  | 'REFRESH_DONE'
  | 'REFRESH_FAILED'
  | 'FOLDER_CREATE_FAILED'
  | 'FOLDER_RENAME_FAILED'
  | 'FOLDER_DELETE_FAILED'
  | 'NOTE_UPDATE_FAILED'
  | 'NOTE_RENAME_FAILED'
  | 'NOTE_CREATE_FAILED'
  | 'NOTE_TRASH_FAILED'
  | 'NOTE_RESTORE_FAILED'
  | 'NOTE_DELETE_FAILED'
  | 'TRASH_EMPTIED'
  | 'TRASH_EMPTY_FAILED'
  | 'NOTE_DUPLICATE_FAILED'
  | 'NOTE_TAGS_FAILED'
  | 'NOTE_MOVE_FAILED'
  | 'TAG_CREATE_FAILED'
  | 'TAG_RENAME_FAILED'
  | 'TAG_DELETE_FAILED'
  | 'NOTE_SAVE_FAILED'

/** User-facing texts that are not tied to one component. */
export const MESSAGES: Readonly<Record<TMessageKey, string>> = {
  CRASH_TITLE:            'Something went wrong',
  CRASH_PAGE:             'This part of the app stopped working. Your notes are safe.',
  CRASH_APP:              'The app stopped working. Your notes are safe; reload to continue.',
  CRASH_ROOT:             'The app could not start. Your notes are safe.',
  CRASH_EDITOR:           'This note could not be shown. Your other notes are safe.',
  NEW_RELEASE_TITLE:      'A new version is available',
  NEW_RELEASE_BODY:       'Reload to start using it.',
  UNEXPECTED_ERROR:       'Something went wrong. If it keeps happening, reload the app.',
  NETWORK_ERROR:          "Couldn't reach the server. Check your connection and try again.",
  REQUEST_FAILED:         'The request failed. Please try again.',
  RELOAD_ACTION:          'Reload',
  TRY_AGAIN_ACTION:       'Try again',
  TOKEN_SCOPE_REQUIRED:   'Choose at least one scope',
  TOKEN_CREATE_FAILED:    'Failed to create token',
  TOKEN_REVOKE_FAILED:    'Failed to revoke token',
  ACCOUNT_UPDATED:        'Account details updated successfully',
  ACCOUNT_UPDATE_FAILED:  'Failed to update account details',
  PASSWORDS_DIFFER:       'Passwords do not match',
  PASSWORD_CHANGED:       'Password updated successfully',
  PASSWORD_CHANGE_FAILED: 'Failed to change password',
  COPY_SAVED:             'Saved your changes as a new note.',
  COPY_SAVE_FAILED:       "Couldn't save copy of note.",
  REFRESH_OFFLINE:        'You are offline. Connect to the internet and try again.',
  REFRESH_DONE:           'All notes and data refreshed from server',
  REFRESH_FAILED:         'Could not sync with remote server. Check your connection.',
  FOLDER_CREATE_FAILED:   "Couldn't create folder.",
  FOLDER_RENAME_FAILED:   "Couldn't rename folder.",
  FOLDER_DELETE_FAILED:   "Couldn't delete folder.",
  NOTE_UPDATE_FAILED:     "Couldn't update that note.",
  NOTE_RENAME_FAILED:     "Couldn't rename note.",
  NOTE_CREATE_FAILED:     "Couldn't create note.",
  NOTE_TRASH_FAILED:      "Couldn't move note to trash.",
  NOTE_RESTORE_FAILED:    "Couldn't restore note.",
  NOTE_DELETE_FAILED:     "Couldn't permanently delete note.",
  TRASH_EMPTIED:          'Trash emptied.',
  TRASH_EMPTY_FAILED:     "Couldn't empty the Trash.",
  NOTE_DUPLICATE_FAILED:  "Couldn't duplicate note.",
  NOTE_TAGS_FAILED:       "Couldn't update tags on note.",
  NOTE_MOVE_FAILED:       "Couldn't move note to folder.",
  TAG_CREATE_FAILED:      "Couldn't create tag.",
  TAG_RENAME_FAILED:      "Couldn't rename tag.",
  TAG_DELETE_FAILED:      "Couldn't delete tag.",
  NOTE_SAVE_FAILED:       "Couldn't save note.",
} as const
