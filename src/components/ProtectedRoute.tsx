import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../app/hooks";

const ProtectedRoute = () => {
  const auth = useAuth();

  return auth.isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
