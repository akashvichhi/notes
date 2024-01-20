import React from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  signin: (callback: VoidFunction) => void;
  signout: (callback: VoidFunction) => void;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AuthContext = React.createContext<AuthContextType>(null!);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const signin = (callback: VoidFunction) => {
    setIsAuthenticated(true);
    callback();
  };

  const signout = (callback: VoidFunction) => {
    setIsAuthenticated(false);
    callback();
  };

  const value = { isLoading, setIsLoading, isAuthenticated, signin, signout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
