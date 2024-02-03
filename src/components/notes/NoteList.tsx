import { Button, Dropdown } from "flowbite-react";
import { memo, useCallback, useEffect, useState } from "react";
import { FiMoreVertical, FiSearch } from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import useDebounce from "../../hooks/useDebounce";
import { setActiveNoteId } from "../../reducers/notes/notesSlice";
import {
  deleteNote as deleteNoteAction,
  fetchNote,
  fetchNotes,
  fetchTrash,
  restoreNote as restoreNoteAction,
} from "../../services/notes/notesServices";
import { RootState } from "../../store/store";
import Note from "../../types/Note";
import Loader from "../common/Loader";
import Input from "../form/Input";
import CreateNote from "./CreateNote";
import DeleteNote from "./DeleteNote";

type ActiveNoteList = "notes" | "trash";

interface NoteListProps {
  show: boolean;
}

const NoteList = memo(({ show }: NoteListProps) => {
  const dispatch = useAppDispatch();
  const { notes, trash, searchStatus, activeNoteId, notesLoading } =
    useAppSelector((state: RootState) => state.notes);
  const [search, setSearch] = useState("");
  const [showRenameNote, setShowRenameNote] = useState<boolean>(false);
  const [showDeleteNote, setShowDeleteNote] = useState<boolean>(false);
  const [noteModal, setNoteModal] = useState<Note | null>(null);
  const [activeNoteList, setActiveNoteList] = useState<ActiveNoteList>("notes");

  const getNotes = useCallback(
    (searchValue?: string) => {
      dispatch(
        fetchNotes({
          search: searchValue ?? search,
        }),
      );
    },
    [search], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const getTrashNotes = useCallback(
    (searchValue?: string) => {
      dispatch(
        fetchTrash({
          search: searchValue ?? search,
        }),
      );
    },
    [search], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setDefaultActiveNoteId = useCallback(() => {
    let id: string = "";
    if (activeNoteList === "trash" && trash.length > 0) {
      id = trash[0].id ?? "";
    } else if (activeNoteList === "notes" && notes.length > 0) {
      id = notes[0].id ?? "";
    }
    dispatch(setActiveNoteId(id));
  }, [activeNoteList, trash, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (notes.length === 0) {
      getNotes();
    }
    if (trash.length === 0) {
      getTrashNotes();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeNoteId) {
      setDefaultActiveNoteId();
    }
  }, [notes, trash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDefaultActiveNoteId();
  }, [activeNoteList]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeNoteId) {
      const activeNote =
        activeNoteList === "trash"
          ? trash.find((note) => note.id === activeNoteId)
          : notes.find((note) => note.id === activeNoteId);
      if (!activeNote || activeNote.notes === undefined) {
        dispatch(fetchNote({ id: activeNoteId }));
      }
    }
  }, [activeNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedSearch = useDebounce((searchValue: string) => {
    if (activeNoteList === "trash") {
      getTrashNotes(searchValue);
    } else {
      getNotes(searchValue);
    }
  }, 800);

  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
      debouncedSearch(event.target.value);
    },
    [activeNoteList], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setActiveNote = useCallback((note: Note) => {
    dispatch(setActiveNoteId(note.id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const renameNote = useCallback((note: Note) => {
    setShowRenameNote(true);
    setNoteModal({ ...note });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeRenameNote = useCallback(() => {
    setShowRenameNote(false);
    setNoteModal(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteNote = useCallback(async (note: Note) => {
    await dispatch(deleteNoteAction({ id: note.id }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreNote = useCallback(async (note: Note) => {
    await dispatch(restoreNoteAction({ id: note.id }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const permanentDeleteNote = useCallback((note: Note) => {
    setShowDeleteNote(true);
    setNoteModal({ ...note });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDeleteNote = useCallback(() => {
    setShowDeleteNote(false);
    setNoteModal(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const noteList: Note[] = activeNoteList === "notes" ? notes : trash;

  return (
    <div className={`notes-list ${show ? "show-notes-list" : ""}`}>
      <Input
        inputProps={{
          type: "search",
          value: search,
          onChange: handleSearch,
          placeholder: "Search...",
        }}
        className="notes-search"
        leftIcon={<FiSearch />}
        rightIcon={
          searchStatus && !!search ? (
            <div className="-mt-1.5">
              <Loader size={"sm"} />
            </div>
          ) : undefined
        }
      />
      <div>
        <Button.Group>
          <Button
            color={activeNoteList === "notes" ? "warning" : "gray"}
            onClick={() => setActiveNoteList("notes")}
          >
            Notes
          </Button>
          <Button
            color={activeNoteList === "trash" ? "warning" : "gray"}
            onClick={() => setActiveNoteList("trash")}
          >
            Trash
          </Button>
        </Button.Group>
      </div>
      <div className="flex-1 overflow-auto">
        {notesLoading ? (
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
                        <Dropdown.Item
                          onClick={() => permanentDeleteNote(note)}
                        >
                          Delete
                        </Dropdown.Item>
                      </>
                    ) : (
                      <>
                        <Dropdown.Item onClick={() => renameNote(note)}>
                          Rename
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
      {showRenameNote && noteModal ? (
        <CreateNote
          show={showRenameNote}
          onClose={closeRenameNote}
          note={noteModal}
        />
      ) : null}
      {showDeleteNote && noteModal ? (
        <DeleteNote
          show={showDeleteNote}
          onClose={closeDeleteNote}
          note={noteModal}
        />
      ) : null}
    </div>
  );
});

export default NoteList;
