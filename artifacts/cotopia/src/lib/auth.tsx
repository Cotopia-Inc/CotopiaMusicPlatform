import React, { createContext, useContext, useState, useEffect } from "react";
import { User, setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Set the auth token getter for custom-fetch
setAuthTokenGetter(() => localStorage.getItem("cotopia_token"));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("cotopia_token"));
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isError) {
      setToken(null);
      localStorage.removeItem("cotopia_token");
    }
  }, [isError]);

  const login = (newUser: User, newToken: string) => {
    setToken(newToken);
    localStorage.setItem("cotopia_token", newToken);
    queryClient.setQueryData(getGetMeQueryKey(), newUser);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("cotopia_token");
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.clear(); // Clear all queries on logout
    // Signal player to stop
    window.dispatchEvent(new CustomEvent("cotopia:logout"));
  };

  useEffect(() => {
    const handleDeactivated = () => {
      setToken(null);
      localStorage.removeItem("cotopia_token");
      queryClient.clear();
      window.dispatchEvent(new CustomEvent("cotopia:logout"));
    };
    window.addEventListener("cotopia:deactivated", handleDeactivated);
    return () => window.removeEventListener("cotopia:deactivated", handleDeactivated);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
