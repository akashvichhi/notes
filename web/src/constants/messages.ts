type TMessageKey =
  | 'SYNC_CHANGE_REJECTED'
  | 'CRASH_TITLE'
  | 'CRASH_PAGE'
  | 'CRASH_APP'
  | 'CRASH_EDITOR'
  | 'NEW_RELEASE_TITLE'
  | 'NEW_RELEASE_BODY'
  | 'UNEXPECTED_ERROR'
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
  | 'NOTE_DUPLICATE_FAILED'
  | 'NOTE_TAGS_FAILED'
  | 'NOTE_MOVE_FAILED'
  | 'TAG_CREATE_FAILED'
  | 'TAG_RENAME_FAILED'
  | 'TAG_DELETE_FAILED'
  | 'NOTE_SAVE_FAILED'

/** User-facing texts that are not tied to one component. */
export const MESSAGES: Readonly<Record<TMessageKey, string>> = {
  SYNC_CHANGE_REJECTED:   'Some changes could not be saved to the cloud. They are still on this device.',
  CRASH_TITLE:            'Something went wrong',
  CRASH_PAGE:             'This part of the app stopped working. Your notes are safe.',
  CRASH_APP:              'The app stopped working. Your notes are safe; reload to continue.',
  CRASH_EDITOR:           'This note could not be shown. Your other notes are safe.',
  NEW_RELEASE_TITLE:      'A new version is available',
  NEW_RELEASE_BODY:       'Reload to start using it.',
  UNEXPECTED_ERROR:       'Something went wrong. If it keeps happening, reload the app.',
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
  REFRESH_OFFLINE:        'Offline. Cannot sync with remote server.',
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
  NOTE_DUPLICATE_FAILED:  "Couldn't duplicate note.",
  NOTE_TAGS_FAILED:       "Couldn't update tags on note.",
  NOTE_MOVE_FAILED:       "Couldn't move note to folder.",
  TAG_CREATE_FAILED:      "Couldn't create tag.",
  TAG_RENAME_FAILED:      "Couldn't rename tag.",
  TAG_DELETE_FAILED:      "Couldn't delete tag.",
  NOTE_SAVE_FAILED:       "Couldn't save note.",
} as const
