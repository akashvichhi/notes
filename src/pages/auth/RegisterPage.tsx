import { Button, Label } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useAppDispatch, useAppSelector, useAuth } from "../../app/hooks";
import { RootState } from "../../app/store";
import Input from "../../components/form/Input";
import { register } from "../../features/authSlice";
import { fetchProfile } from "../../features/profileSlice";
import { FaEye } from "react-icons/fa6";

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
      if (passwordRef.current.type === "password") {
        passwordRef.current.type = "text";
      } else {
        passwordRef.current.type = "password";
      }
    }
  };

  return (
    <div className="bg-gray-100 flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
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
                id="name"
                type="text"
                name="name"
                value={values.name}
                onChange={handleChange}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <div className="mt-1">
              <Input
                id="email"
                type="text"
                name="email"
                value={values.email}
                onChange={handleChange}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <div className="relative mt-1">
              <Input
                ref={passwordRef}
                id="password"
                type={passwordRef.current?.type ?? "password"}
                name="password"
                value={values.password}
                onChange={handleChange}
              />
              <FaEye
                className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2"
                onClick={togglePassordVisibility}
              />
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="confirm_password">Confirm Password</Label>
            </div>
            <div className="mt-1">
              <Input
                id="confirm_password"
                type="password"
                name="confirmPassword"
                value={values.confirmPassword}
                onChange={handleChange}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword}</p>
            )}
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
