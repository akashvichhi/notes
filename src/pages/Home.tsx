import { Button } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector, useAuth } from "../app/hooks";
import { logout } from "../features/authSlice";
import { RootState } from "../app/store";
import { useEffect } from "react";

const HomePage = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isSuccess } = useAppSelector((state: RootState) => state.auth);

  const signout = async () => {
    await dispatch(logout());
    auth.signout(() => {
      navigate("/login");
    });
  };

  useEffect(() => {
    if (isSuccess) {
      // auth.signout(() => {
      //   navigate("/login");
      // });
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1>Home page</h1>
      <Button onClick={signout}>Logout</Button>
    </div>
  );
};

export default HomePage;
