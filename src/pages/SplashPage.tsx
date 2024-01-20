import { useEffect } from "react";
import { useAuth } from "../app/hooks";
import config from "../config/app";
import cookies from "../config/cookie";

const SplashPage = () => {
  const auth = useAuth();

  const checkAuth = async () => {
    const token = cookies.get(config.accessTokenKey);
    if (token) {
      //
    }
    auth.setIsLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1>Splash page</h1>
    </div>
  );
};

export default SplashPage;
