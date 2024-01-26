import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useAppDispatch, useAppSelector, useAuth } from "./app/hooks";
import { RootState } from "./app/store";
import ProtectedRoute from "./components/ProtectedRoute";
import { fetchProfile } from "./features/profileSlice";
import AppLayout from "./layout/AppLayout";
import HomePage from "./pages/Home";
import Splash from "./pages/Splash";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import NotFoundPage from "./pages/errors/404";
import { getSession } from "./utils/session";

function App() {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const { isSuccess, isError } = useAppSelector(
    (state: RootState) => state.profile
  );
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    const token = getSession();
    if (!token) {
      setLoading(false);
      return;
    }

    dispatch(fetchProfile());
  };

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isSuccess) {
      auth.signin(() => {
        setLoading(false);
      });
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isError) {
      setLoading(false);
    }
  }, [isError]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <Splash />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
