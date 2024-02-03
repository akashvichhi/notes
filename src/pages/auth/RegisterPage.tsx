import { Button, Label } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useCallback, useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiMail, FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import Loader from "../../components/common/Loader";
import Input from "../../components/form/Input";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { useAuth } from "../../hooks/useAuth";
import { register } from "../../services/auth/authServices";
import { fetchProfile } from "../../services/profile/profileServices";
import { RootState } from "../../store/store";

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
};

const validator = Yup.object({
  name: Yup.string().required("Name is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().required("Password is required"),
  confirmPassword: Yup.string()
    .required("Confirm password is required")
    .oneOf([Yup.ref("password")], "Passwords do not match"),
});

const RegisterPage = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status } = useAppSelector((state: RootState) => state.auth);

  const passwordRef = createRef<HTMLInputElement>();
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { values, handleChange, errors, handleSubmit } = useFormik({
    initialValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: (values: FormData) => {
      submit(values);
    },
    validationSchema: validator,
    validateOnBlur: false,
    validateOnChange: false,
  });

  const submit = useCallback((data: FormData) => {
    dispatch(register(data));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signin = useCallback(async () => {
    await dispatch(fetchProfile());
    auth.signin(() => {
      navigate("/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (status === "fulfilled") {
      signin();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Create your account
        </h2>
      </div>

      <div className="bg-white shadow p-8 rounded-xl mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
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
                  onChange: handleChange,
                }}
                leftIcon={<FiMail />}
                helperText={errors.email ?? ""}
                color={"error"}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
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
                leftIcon={<FiLock />}
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
                helperText={errors.password ?? ""}
                color={"error"}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="confirm_password">Confirm Password</Label>
            </div>
            <div className="mt-1">
              <Input
                inputProps={{
                  id: "confirm_password",
                  type: "password",
                  name: "confirmPassword",
                  value: values.confirmPassword,
                  onChange: handleChange,
                }}
                leftIcon={<FiLock />}
                helperText={errors.confirmPassword ?? ""}
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
              Sign up
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?&nbsp;
          <Link
            to="/login"
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
