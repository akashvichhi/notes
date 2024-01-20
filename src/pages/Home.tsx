import { Button } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/hooks";

const HomePage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const logout = () => {
    auth.signout(() => {
      navigate("/");
    });
  };

  return (
    <div>
      <h1>Home page</h1>
      <Button onClick={logout}>Logout</Button>
    </div>
  );
};

export default HomePage;
