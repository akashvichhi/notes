import { lazy, useEffect, useState, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./hooks/redux";
import { useAuth } from "./hooks/useAuth";
import { fetchProfile } from "./services/profile/profileServices";
import { RootState } from "./store/store";
import { getSession } from "./utils/session";

const ProtectedRoute = lazy(() => import("./components/routes/ProtectedRoute"));
const AppLayout = lazy(() => import("./layout/AppLayout"));
const Notes = lazy(() => import("./pages/Notes"));
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
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Notes />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
