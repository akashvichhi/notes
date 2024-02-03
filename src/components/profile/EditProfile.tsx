import { Button, Label, Modal } from "flowbite-react";
import { useFormik } from "formik";
import { useEffect } from "react";
import { FiMail, FiUser } from "react-icons/fi";
import * as Yup from "yup";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { updateProfile } from "../../services/profile/profileServices";
import { RootState } from "../../store/store";
import Loader from "../common/Loader";
import Input from "../form/Input";

type FormData = {
  name: string;
  email: string;
};

const validator = Yup.object({
  name: Yup.string().required("Name is required"),
});

interface EditProfileProps {
  show: boolean;
  onClose: () => void;
}

const EditProfile = ({ show, onClose }: EditProfileProps) => {
  const dispatch = useAppDispatch();
  const { status, user } = useAppSelector((state: RootState) => state.profile);

  const { values, handleChange, errors, handleSubmit } = useFormik({
    initialValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
    },
    onSubmit: (values: FormData) => {
      dispatch(updateProfile(values));
    },
    validationSchema: validator,
    validateOnBlur: false,
    validateOnChange: false,
  });

  useEffect(() => {
    if (user) {
      values.name = user?.name ?? "";
      values.email = user?.email ?? "";
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal show={show} onClose={onClose} size={"md"}>
      <Modal.Header>Update Profile</Modal.Header>
      <Modal.Body>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="name">Name</Label>
            <div className="mt-1">
              <Input
                inputProps={{
                  id: "name",
                  type: "text",
                  name: "name",
                  value: values.name,
                  onChange: handleChange,
                }}
                helperText={errors.name ?? ""}
                color={"error"}
                leftIcon={<FiUser />}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <div className="mt-1">
              <Input
                inputProps={{
                  id: "email",
                  type: "email",
                  name: "email",
                  value: values.email,
                  disabled: true,
                }}
                leftIcon={<FiMail />}
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
              Update
            </Button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default EditProfile;
