import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import { Button, Tooltip } from "flowbite-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiMenu, FiPlus, FiSave, FiX } from "react-icons/fi";
import "../assets/css//components/_ckeditor.scss";
import "../assets/css/notes.scss";
import Loader from "../components/common/Loader";
import CreateNote from "../components/notes/CreateNote";
import NoteList from "../components/notes/NoteList";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { updateCurrentNote } from "../reducers/notes/notesSlice";
import { updateNote } from "../services/notes/notesServices";
import { RootState } from "../store/store";

const Notes = () => {
  const dispatch = useAppDispatch();
  const { notes, trash, activeNoteId, status } = useAppSelector(
    (state: RootState) => state.notes,
  );
  const note = useMemo(() => {
    return (
      notes.find((note) => note.id === activeNoteId) ??
      trash.find((note) => note.id === activeNoteId)
    );
  }, [notes, trash, activeNoteId]);

  const [showCreateNote, setShowCreateNote] = useState<boolean>(false);
  const [showNoteList, setShowNoteList] = useState<boolean>(false);

  const saveNote = useCallback(() => {
    if (note) {
      dispatch(updateNote({ id: note.id, notes: note.notes }));
    }
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "s" || event.key === "S") {
          event.preventDefault();
          saveNote();
        } else if (event.key === "n" || event.key === "N") {
          event.preventDefault();
          setShowCreateNote(true);
        }
      }
    },
    [note], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeNoteId) {
      setShowNoteList(false);
    }
  }, [activeNoteId]);

  return (
    <div className="notes-container">
      <NoteList show={showNoteList} />
      <div className="notes flex-1">
        <div className="notes-header">
          <div className="flex items-center">
            {!showNoteList && (
              <Button
                color="dark"
                size={"xs"}
                className="md:hidden btn-save-note"
                onClick={() => setShowNoteList(!showNoteList)}
              >
                <FiMenu size={20} />
              </Button>
            )}
            {showNoteList && (
              <Button
                color="dark"
                size={"xs"}
                className="md:hidden btn-save-note btn-notes-list-close"
                onClick={() => setShowNoteList(false)}
              >
                <FiX size={20} />
              </Button>
            )}
            {note?.name ? (
              <span className="notes-header-item">
                {note?.name ?? ""}
                {note?.isSaved === false && <sup className="text-sm">*</sup>}
              </span>
            ) : null}
            <Tooltip content="Create new note" className="z-[9999]">
              <Button
                color="warning"
                size={"xs"}
                className="btn-create-note"
                onClick={() => setShowCreateNote(true)}
              >
                <FiPlus size={20} />
              </Button>
            </Tooltip>
          </div>
          <div>
            <Tooltip content="Save" className="z-[9999]">
              <Button
                size={"xs"}
                color="success"
                className="btn-save-note"
                onClick={saveNote}
                isProcessing={status === "pending"}
                processingSpinner={<Loader size={"sm"} />}
                disabled={status === "pending" || !note || note.isDeleted}
              >
                <FiSave size={20} />
              </Button>
            </Tooltip>
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
