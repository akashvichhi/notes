import { Route, Routes } from "react-router-dom";
import { useAuth } from "./app/hooks";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/Home";
import SplashPage from "./pages/SplashPage";
import LoginPage from "./pages/auth/LoginPage";

function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <SplashPage />;
  }

  return (
    <div className="p-3">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
