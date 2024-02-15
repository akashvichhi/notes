import { Button, Tooltip } from "flowbite-react";
import { FiMenu, FiPlus, FiRotateCw, FiSave, FiX } from "react-icons/fi";
import { useAppSelector } from "../../hooks/redux";
import { RootState } from "../../store/store";
import Note from "../../types/Note";
import Loader from "../common/Loader";

interface NotesHeaderProps {
  showNoteList: boolean;
  toggleNoteList: (show: boolean) => void;
  note?: Note;
  createNote: () => void;
  reloadNote: () => void;
  saveNote: () => void;
}

const NotesHeader = ({
  showNoteList,
  toggleNoteList,
  note,
  createNote,
  reloadNote,
  saveNote,
}: NotesHeaderProps) => {
  const { status, action } = useAppSelector((state: RootState) => state.notes);

  return (
    <div className="notes-header">
      <div className="flex items-center">
        {!showNoteList && (
          <Button
            color="dark"
            size={"xs"}
            className="md:hidden btn-save-note"
            onClick={() => toggleNoteList(!showNoteList)}
          >
            <FiMenu size={20} />
          </Button>
        )}
        {showNoteList && (
          <Button
            color="dark"
            size={"xs"}
            className="md:hidden btn-save-note btn-notes-list-close"
            onClick={() => toggleNoteList(false)}
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
            onClick={createNote}
          >
            <FiPlus size={20} />
          </Button>
        </Tooltip>
      </div>
      <div className="flex gap-1">
        <Tooltip content="Reload" className="z-[9999]">
          <Button
            size={"xs"}
            color="warning"
            className="btn-save-note"
            onClick={reloadNote}
            isProcessing={status === "pending" && action === "fetch"}
            processingSpinner={<Loader size={"sm"} />}
            disabled={
              (status === "pending" && action === "fetch") ||
              !note ||
              note.isDeleted
            }
          >
            <FiRotateCw size={20} />
          </Button>
        </Tooltip>
        <Tooltip content="Save" className="z-[9999]">
          <Button
            size={"xs"}
            color="success"
            className="btn-save-note"
            onClick={saveNote}
            isProcessing={status === "pending" && action === "save"}
            processingSpinner={<Loader size={"sm"} />}
            disabled={
              (status === "pending" && action === "save") ||
              !note ||
              note.isDeleted
            }
          >
            <FiSave size={20} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default NotesHeader;
