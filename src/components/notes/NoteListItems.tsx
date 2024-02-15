import { Dropdown } from "flowbite-react";
import { useCallback } from "react";
import { FiMoreVertical, FiStar } from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import {
  deleteNote as deleteNoteAction,
  restoreNote as restoreNoteAction,
  starNote as starNoteAction,
} from "../../services/notes/notesServices";
import { RootState } from "../../store/store";
import Note from "../../types/Note";
import Loader from "../common/Loader";

interface NoteListItemsProps {
  noteList: Note[];
  setActiveNote: (note: Note) => void;
  renameNote: (note: Note) => void;
  permanentDeleteNote: (note: Note) => void;
}

const NoteListItems = ({
  noteList,
  setActiveNote,
  renameNote,
  permanentDeleteNote,
}: NoteListItemsProps) => {
  const dispatch = useAppDispatch();
  const { action, activeNoteId, status } = useAppSelector(
    (state: RootState) => state.notes
  );

  const starNote = useCallback(async (note: Note) => {
    dispatch(starNoteAction({ id: note.id, isStarred: !note.isStarred }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteNote = useCallback(async (note: Note) => {
    dispatch(deleteNoteAction({ id: note.id }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreNote = useCallback(async (note: Note) => {
    dispatch(restoreNoteAction({ id: note.id }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-auto">
      {(action === "fetchAll" || action === "fetchTrash") &&
      status === "pending" ? (
        <div className="text-center">
          <Loader />
        </div>
      ) : (
        <div className="notes-list-list">
          {noteList.length === 0 && <p>No notes found</p>}
          {noteList.map((note: Note) => (
            <div
              className={`note ${activeNoteId === note.id ? "active" : ""}`}
              onClick={() => setActiveNote(note)}
              key={note.id}
            >
              {note.name}
              {note.isSaved === false && <sup className="text-sm">*</sup>}
              {note.isStarred && (
                <div className="absolute right-8 top-[50%] -translate-y-[50%]">
                  <FiStar />
                </div>
              )}
              <div className="note-actions">
                <Dropdown
                  label={""}
                  inline
                  renderTrigger={() => (
                    <div>
                      <FiMoreVertical className="cursor-pointer" />
                    </div>
                  )}
                  placement="bottom-end"
                  className="z-20"
                >
                  {note.isDeleted ? (
                    <>
                      <Dropdown.Item onClick={() => restoreNote(note)}>
                        Restore
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => permanentDeleteNote(note)}>
                        Delete
                      </Dropdown.Item>
                    </>
                  ) : (
                    <>
                      <Dropdown.Item onClick={() => renameNote(note)}>
                        Rename
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => starNote(note)}>
                        {note.isStarred ? "Unstar" : "Star"}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => deleteNote(note)}>
                        Delete
                      </Dropdown.Item>
                    </>
                  )}
                </Dropdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteListItems;
