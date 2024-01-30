import { Button, Modal } from "flowbite-react";
import { useCallback } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { forceDeleteNote } from "../../actions/notes/notesActions";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { RootState } from "../../store/store";
import Note from "../../types/Note";

interface DeleteNoteProps {
  show: boolean;
  onClose: () => void;
  note: Note;
}

const DeleteNote = ({ show, note, onClose }: DeleteNoteProps) => {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector((state: RootState) => state.notes);

  const deleteNote = useCallback(async () => {
    await dispatch(forceDeleteNote({ id: note.id! }));
    onClose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal show={show} size="md" onClose={onClose} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="text-center">
          <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
          <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this note?
          </h3>
          <div className="flex justify-center gap-4">
            <Button
              color="failure"
              onClick={deleteNote}
              disabled={status === "pending"}
              isProcessing={status === "pending"}
            >
              Delete
            </Button>
            <Button color="gray" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default DeleteNote;
