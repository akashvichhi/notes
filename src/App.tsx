import { lazy, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { fetchProfile } from "./reducers/profileSlice";
import { useAppDispatch, useAppSelector, useAuth } from "./store/hooks";
import { RootState } from "./store/store";
import { getSession } from "./utils/session";

const ProtectedRoute = lazy(() => import("./components/routes/ProtectedRoute"));
const AppLayout = lazy(() => import("./layout/AppLayout"));
const HomePage = lazy(() => import("./pages/Home"));
const SplashScreen = lazy(() => import("./pages/Splash"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const NotFoundPage = lazy(() => import("./pages/errors/404"));

function App() {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const { status } = useAppSelector((state: RootState) => state.profile);
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
    if (status === "fulfilled") {
      auth.signin(() => {
        setLoading(false);
      });
    } else if (status === "rejected") {
      setLoading(false);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <SplashScreen />;
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
