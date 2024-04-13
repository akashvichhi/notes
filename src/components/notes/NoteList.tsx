import { Button, Tooltip } from "flowbite-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FiRotateCw, FiSearch } from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import useDebounce from "../../hooks/useDebounce";
import { setActiveNoteId } from "../../reducers/notes/notesSlice";
import {
  fetchNote,
  fetchNotes,
  fetchTrash,
} from "../../services/notes/notesServices";
import { RootState } from "../../store/store";
import Note from "../../types/Note";
import Loader from "../common/Loader";
import Input from "../form/Input";
import CreateNote from "./CreateNote";
import DeleteNote from "./DeleteNote";
import NoteListItems from "./NoteListItems";

type ActiveNoteList = "notes" | "starred" | "trash";

interface NoteListProps {
  show: boolean;
}

const NoteList = memo(({ show }: NoteListProps) => {
  const dispatch = useAppDispatch();
  const { notes, trash, action, activeNoteId, status } = useAppSelector(
    (state: RootState) => state.notes,
  );
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
    } else if (activeNoteList === "starred" && notes.length > 0) {
      id = notes.filter((note) => note.isStarred)[0]?.id ?? "";
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
    if (!activeNoteId || activeNoteList === "starred") {
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

  const loadNotes = useCallback(
    (searchValue?: string) => {
      if (activeNoteList === "trash") {
        getTrashNotes(searchValue);
      } else {
        getNotes(searchValue);
      }
    },
    [activeNoteList], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const debouncedSearch = useDebounce((searchValue: string) => {
    loadNotes(searchValue);
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

  const permanentDeleteNote = useCallback((note: Note) => {
    setShowDeleteNote(true);
    setNoteModal({ ...note });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDeleteNote = useCallback(() => {
    setShowDeleteNote(false);
    setNoteModal(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const noteList: Note[] = useMemo(() => {
    if (activeNoteList === "notes") {
      return notes;
    } else if (activeNoteList === "starred") {
      return notes.filter((note) => note.isStarred);
    } else {
      return trash;
    }
  }, [activeNoteList, notes, trash]);

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
          (action === "fetchAll" || action === "fetchTrash") &&
          status === "pending" &&
          !!search ? (
            <div className="-mt-1.5">
              <Loader size={"sm"} />
            </div>
          ) : undefined
        }
      />
      <div className="flex items-center justify-between gap-2">
        <Button.Group>
          <Button
            color={activeNoteList === "notes" ? "warning" : "gray"}
            onClick={() => setActiveNoteList("notes")}
          >
            Notes
          </Button>
          <Button
            color={activeNoteList === "starred" ? "warning" : "gray"}
            onClick={() => setActiveNoteList("starred")}
          >
            Starred
          </Button>
          <Button
            color={activeNoteList === "trash" ? "warning" : "gray"}
            onClick={() => setActiveNoteList("trash")}
          >
            Trash
          </Button>
        </Button.Group>
        <div>
          <Tooltip content="Reload" className="z-[9999]">
            <Button
              size={"xs"}
              color="warning"
              className="btn-save-note"
              onClick={() => loadNotes(search)}
              isProcessing={
                status === "pending" &&
                (action === "fetchAll" || action === "fetchTrash")
              }
              processingSpinner={<Loader size={"sm"} />}
              disabled={
                status === "pending" &&
                (action === "fetchAll" || action === "fetchTrash")
              }
            >
              <FiRotateCw size={20} />
            </Button>
          </Tooltip>
        </div>
      </div>
      <NoteListItems
        noteList={noteList}
        setActiveNote={(note) => setActiveNote(note)}
        renameNote={renameNote}
        permanentDeleteNote={permanentDeleteNote}
      />
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
