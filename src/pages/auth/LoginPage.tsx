import { Button } from "flowbite-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/hooks";

const LoginPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const login = () => {
    auth.signin(() => {
      navigate("/");
    });
  };

  return (
    <div>
      <h1>Login page</h1>
      <Button onClick={login}>Login</Button>
    </div>
  );
};

export default LoginPage;
