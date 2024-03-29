import { Button, Label, Modal } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useEffect } from "react";
import * as Yup from "yup";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { createNote, renameNote } from "../../services/notes/notesServices";
import { RootState } from "../../store/store";
import Note from "../../types/Note";
import Loader from "../common/Loader";
import Input from "../form/Input";

type FormData = {
  name: string;
};

const validator = Yup.object({
  name: Yup.string().required("Name is required"),
});

interface CreateNoteProps {
  show: boolean;
  onClose: () => void;
  note?: Note;
}

const CreateNote = ({ show, onClose, note }: CreateNoteProps) => {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector((state: RootState) => state.notes);
  const nameRef = createRef<HTMLInputElement>();

  const { values, handleChange, errors, handleSubmit } = useFormik({
    initialValues: {
      name: note?.name ?? "",
    },
    onSubmit: async (values: FormData) => {
      if (note?.id) {
        await dispatch(renameNote({ id: note.id!, name: values.name }));
      } else {
        await dispatch(createNote(values));
      }
      onClose();
    },
    validationSchema: validator,
    validateOnBlur: false,
    validateOnChange: false,
  });

  useEffect(() => {
    setTimeout(() => {
      if (nameRef.current) {
        nameRef.current.focus();
      }
    });
  }, [nameRef]);

  return (
    <Modal show={show} onClose={onClose} size={"md"}>
      <Modal.Header>{note?.id ? "Rename Note" : "Create Note"}</Modal.Header>
      <Modal.Body>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="name">Name</Label>
            <div className="mt-1">
              <Input
                ref={nameRef}
                inputProps={{
                  id: "name",
                  type: "text",
                  name: "name",
                  value: values.name,
                  onChange: handleChange,
                }}
                helperText={errors.name ?? ""}
                color={"error"}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              color="warning"
              type="submit"
              className="w-full"
              disabled={status === "pending"}
              isProcessing={status === "pending"}
              processingSpinner={<Loader size={"sm"} />}
            >
              {note?.id ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default CreateNote;
