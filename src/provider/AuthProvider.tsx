import React from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  signin: (callback: VoidFunction) => void;
  signout: (callback: VoidFunction) => void;
}

export const AuthContext = React.createContext<AuthContextType>(null!);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);

  const signin = (callback: VoidFunction) => {
    setIsAuthenticated(true);
    setTimeout(callback);
  };

  const signout = (callback: VoidFunction) => {
    setIsAuthenticated(false);
    setTimeout(callback);
  };

  const value = { isAuthenticated, signin, signout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
