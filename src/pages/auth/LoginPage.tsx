import { Button, Label } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useEffect, useState } from "react";
import { FaEye, FaEyeSlash, FaLock, FaRegEnvelope } from "react-icons/fa6";
import { Link, Navigate, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useAppDispatch, useAppSelector, useAuth } from "../../app/hooks";
import { RootState } from "../../app/store";
import Input from "../../components/form/Input";
import { login } from "../../features/authSlice";
import { fetchProfile } from "../../features/profileSlice";

type FormData = {
  email: string;
  password: string;
};

const validator = Yup.object({
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().required("Password is required"),
});

const LoginPage = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, isSuccess } = useAppSelector(
    (state: RootState) => state.auth
  );
  const passwordRef = createRef<HTMLInputElement>();
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { values, handleChange, errors, handleSubmit } = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    onSubmit: (values: FormData) => {
      submit(values);
    },
    validationSchema: validator,
    validateOnBlur: false,
    validateOnChange: false,
  });

  const submit = (data: FormData) => {
    dispatch(login(data));
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

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="bg-gray-100 flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="bg-white shadow p-8 rounded-xl mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="mt-1">
              <Input
                id="email"
                type="text"
                name="email"
                value={values.email}
                onChange={handleChange}
                leftIcon={<FaRegEnvelope />}
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
            <div className="mt-1">
              <Input
                ref={passwordRef}
                id="password"
                type={passwordRef.current?.type ?? "password"}
                name="password"
                value={values.password}
                onChange={handleChange}
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
              />
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              isProcessing={isLoading}
            >
              Sign in
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Does not have an account?&nbsp;
          <Link
            to="/register"
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
