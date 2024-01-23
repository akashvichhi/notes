import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useAppDispatch, useAuth } from "./app/hooks";
import ProtectedRoute from "./components/ProtectedRoute";
import { fetchProfile } from "./features/profileSlice";
import HomePage from "./pages/Home";
import SplashPage from "./pages/SplashPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
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
    return <SplashPage />;
  }

  return (
    <main>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </main>
  );
}

export default App;
