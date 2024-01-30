import { Button, Label, Modal } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useCallback, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import * as Yup from "yup";
import { changePassword } from "../../actions/profile/profileActions";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { RootState } from "../../store/store";
import Input from "../form/Input";

type FormData = {
  currentPassword: string;
  password: string;
  confirmPassword: string;
};

const validator = Yup.object({
  currentPassword: Yup.string().required("Current Password is required"),
  password: Yup.string().required("Password is required"),
  confirmPassword: Yup.string()
    .required("Confirm Password is required")
    .oneOf([Yup.ref("password")], "Passwords do not match"),
});

interface ChangePasswordProps {
  show: boolean;
  onClose: () => void;
}

const ChangePassword = ({ show, onClose }: ChangePasswordProps) => {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector((state: RootState) => state.profile);
  const passwordRef = createRef<HTMLInputElement>();
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { values, handleChange, errors, handleSubmit } = useFormik({
    initialValues: {
      confirmPassword: "",
      password: "",
      currentPassword: "",
    },
    onSubmit: (values: FormData) => {
      dispatch(changePassword(values));
    },
    validationSchema: validator,
    validateOnBlur: false,
    validateOnChange: false,
  });

  const togglePassordVisibility = useCallback(() => {
    if (passwordRef.current) {
      setShowPassword(!showPassword);
      if (passwordRef.current.type === "password") {
        passwordRef.current.type = "text";
      } else {
        passwordRef.current.type = "password";
      }
    }
  }, [passwordRef]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal show={show} onClose={onClose} size={"md"}>
      <Modal.Header>Change Password</Modal.Header>
      <Modal.Body>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="name">Current Password</Label>
            <div className="mt-1">
              <Input
                inputProps={{
                  id: "currentPassword",
                  type: "password",
                  name: "currentPassword",
                  value: values.currentPassword,
                  onChange: handleChange,
                }}
                helperText={errors.currentPassword ?? ""}
                color={"error"}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="name">New Password</Label>
            <div className="mt-1">
              <Input
                ref={passwordRef}
                inputProps={{
                  id: "password",
                  type: showPassword ? "text" : "password",
                  name: "password",
                  value: values.password,
                  onChange: handleChange,
                }}
                helperText={errors.password ?? ""}
                color={"error"}
                rightIcon={
                  showPassword ? (
                    <FiEyeOff
                      className="cursor-pointer"
                      onClick={togglePassordVisibility}
                    />
                  ) : (
                    <FiEye
                      className="cursor-pointer"
                      onClick={togglePassordVisibility}
                    />
                  )
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="name">Confirm New Password</Label>
            <div className="mt-1">
              <Input
                inputProps={{
                  id: "confirmPassword",
                  type: "password",
                  name: "confirmPassword",
                  value: values.confirmPassword,
                  onChange: handleChange,
                }}
                helperText={errors.confirmPassword ?? ""}
                color={"error"}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              disabled={status === "pending"}
              isProcessing={status === "pending"}
            >
              Update
            </Button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default ChangePassword;
