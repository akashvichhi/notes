import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import { Button, Tooltip } from "flowbite-react";
import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import "../assets/css/ckeditor.scss";
import "../assets/css/notes.scss";
import CreateNote from "../components/notes/CreateNote";
import FileList from "../components/notes/NoteList";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { updateCurrentNote, updateNote } from "../reducers/notesSlice";
import { RootState } from "../store/store";

const Notes = () => {
  const dispatch = useAppDispatch();
  const { notes, trash, activeNoteId, status } = useAppSelector(
    (state: RootState) => state.notes,
  );
  const note =
    notes.find((note) => note.id === activeNoteId) ??
    trash.find((note) => note.id === activeNoteId);
  const [showCreateNote, setShowCreateNote] = useState<boolean>(false);

  const saveNote = () => {
    if (note) {
      dispatch(updateNote({ id: note.id, notes: note.notes }));
    }
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        saveNote();
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex notes-container">
      <FileList />
      <div className="notes flex-1">
        <div className="notes-header">
          <div className="flex items-center">
            {note?.name ? (
              <span className="notes-header-item">
                {note?.name ?? ""}
                {note?.isSaved === false && <sup className="text-sm">*</sup>}
              </span>
            ) : null}
            <Tooltip content="Create new note">
              <Button
                size={"xs"}
                className="btn-create-note"
                onClick={() => setShowCreateNote(true)}
              >
                <FiPlus size={20} />
              </Button>
            </Tooltip>
          </div>
          <div>
            <Button
              size={"xs"}
              color="success"
              className="btn-save-note"
              onClick={saveNote}
              isProcessing={status === "pending"}
              disabled={status === "pending" || !note || note.isDeleted}
            >
              Save
            </Button>
          </div>
        </div>
        <CKEditor
          key={note?.id ?? "ckeditor"}
          editor={ClassicEditor}
          disabled={(note?.isDeleted || !activeNoteId) ?? false}
          data={note?.notes ?? ""}
          onChange={(_, editor: ClassicEditor) => {
            const newNote = editor.getData();
            if (note?.notes !== undefined) {
              dispatch(updateCurrentNote({ id: note.id, notes: newNote }));
            }
          }}
        />
      </div>
      {showCreateNote && (
        <CreateNote
          show={showCreateNote}
          onClose={() => setShowCreateNote(false)}
        />
      )}
    </div>
  );
};

export default Notes;
