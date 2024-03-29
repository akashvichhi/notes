import { Button, Label } from "flowbite-react";
import { useFormik } from "formik";
import { createRef, useCallback, useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import { Link, Navigate, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import Loader from "../../components/common/Loader";
import Input from "../../components/form/Input";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { useAuth } from "../../hooks/useAuth";
import { login } from "../../services/auth/authServices";
import { fetchProfile } from "../../services/profile/profileServices";
import { RootState } from "../../store/store";

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
  const { status } = useAppSelector((state: RootState) => state.auth);
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

  const submit = useCallback((data: FormData) => {
    dispatch(login(data));
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

  if (auth.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
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
                inputProps={{
                  id: "email",
                  type: "text",
                  name: "email",
                  value: values.email,
                  onChange: handleChange,
                  autoFocus: true,
                }}
                helperText={errors.email ?? ""}
                color={"error"}
                leftIcon={<FiMail />}
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
                helperText={errors.password ?? ""}
                color={"error"}
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
