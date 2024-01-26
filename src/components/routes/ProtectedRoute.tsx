import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../store/hooks";

const ProtectedRoute = () => {
  const auth = useAuth();

  return auth.isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
