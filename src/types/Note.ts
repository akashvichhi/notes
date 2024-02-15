interface Note {
  id?: string;
  name: string;
  notes?: string;
  isDeleted?: boolean;
  isSaved?: boolean;
  isStarred?: boolean;
}

export type NoteAction =
  | "fetch"
  | "fetchAll"
  | "fetchTrash"
  | "save"
  | "delete"
  | "forceDelete"
  | "restore"
  | "rename"
  | "star"
  | null;

export default Note;
