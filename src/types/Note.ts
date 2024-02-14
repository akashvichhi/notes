interface Note {
  id?: string;
  name: string;
  notes?: string;
  isDeleted?: boolean;
  isSaved?: boolean;
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
  | null;

export default Note;
