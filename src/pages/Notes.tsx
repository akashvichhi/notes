import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../assets/css//components/_ckeditor.scss";
import "../assets/css/notes.scss";
import CreateNote from "../components/notes/CreateNote";
import NoteList from "../components/notes/NoteList";
import NotesHeader from "../components/notes/NotesHeader";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { updateCurrentNote } from "../reducers/notes/notesSlice";
import { fetchNote, updateNote } from "../services/notes/notesServices";
import { RootState } from "../store/store";

const Notes = () => {
  const dispatch = useAppDispatch();
  const { notes, trash, activeNoteId } = useAppSelector(
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
  const [isNoteReloaded, setIsNoteReloaded] = useState<boolean>(false);

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

  const reloadNote = async () => {
    setIsNoteReloaded(true);
    await dispatch(fetchNote({ id: activeNoteId }));
    setIsNoteReloaded(false);
  };

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
        <NotesHeader
          note={note}
          reloadNote={reloadNote}
          saveNote={saveNote}
          createNote={() => setShowCreateNote(true)}
          showNoteList={showNoteList}
          toggleNoteList={setShowNoteList}
        />
        <CKEditor
          key={note?.id ?? "ckeditor"}
          editor={ClassicEditor}
          disabled={(note?.isDeleted || !activeNoteId) ?? false}
          data={note?.notes ?? ""}
          onChange={(_, editor: ClassicEditor) => {
            const newNote = editor.getData();
            if (note?.notes !== undefined && !isNoteReloaded) {
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
