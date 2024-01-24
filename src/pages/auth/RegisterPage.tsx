import { Button, Label } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useEffect, useState } from "react";
import { FaEye, FaEyeSlash, FaLock, FaRegEnvelope } from "react-icons/fa6";
import { FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useAppDispatch, useAppSelector, useAuth } from "../../app/hooks";
import { RootState } from "../../app/store";
import Input from "../../components/form/Input";
import { register } from "../../features/authSlice";
import { fetchProfile } from "../../features/profileSlice";

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
  const { isLoading, isSuccess } = useAppSelector(
    (state: RootState) => state.auth,
  );

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

  const submit = (data: FormData) => {
    dispatch(register(data));
  };

  useEffect(() => {
    if (isSuccess) {
      dispatch(fetchProfile());
      auth.signin(() => {
        navigate("/");
      });
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePassordVisibility = () => {
    if (passwordRef.current) {
      setShowPassword(!showPassword);
      if (passwordRef.current.type === "password") {
        passwordRef.current.type = "text";
      } else {
        passwordRef.current.type = "password";
      }
    }
  };

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
                leftIcon={<FaRegEnvelope />}
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
                leftIcon={<FaLock />}
                rightIcon={
                  showPassword ? (
                    <FaEyeSlash
                      className="cursor-pointer"
                      onClick={togglePassordVisibility}
                    />
                  ) : (
                    <FaEye
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
                  type: showPassword ? "text" : "password",
                  name: "confirmPassword",
                  value: values.confirmPassword,
                  onChange: handleChange,
                }}
                leftIcon={<FaLock />}
                helperText={errors.confirmPassword ?? ""}
                color={"error"}
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              isProcessing={isLoading}
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
