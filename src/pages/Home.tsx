import { Button } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAuth } from "../app/hooks";
import { logout } from "../features/authSlice";

const HomePage = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const signout = async () => {
    await dispatch(logout());
    auth.signout(() => {
      navigate("/login");
    });
  };

  return (
    <div>
      <h1>Home page</h1>
      <Button onClick={signout}>Logout</Button>
    </div>
  );
};

export default HomePage;
