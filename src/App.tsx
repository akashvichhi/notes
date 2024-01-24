import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useAppDispatch, useAuth } from "./app/hooks";
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

  const checkAuth = async () => {
    const token = getSession();
    if (!token) {
      auth.setIsLoading(false);
      return;
    }

    dispatch(fetchProfile());
  };

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (auth.isLoading) {
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
