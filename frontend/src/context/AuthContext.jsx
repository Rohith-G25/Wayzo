import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  getAuthToken,
  getRefreshToken,
  setAuthSession,
  clearAuthSession,
} from "../services/api";
import detectionService from "../services/detectionService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("wayzo_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => getAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and validate session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await detectionService.getCurrentUser();
        setUser(currentUser);
        localStorage.setItem("wayzo_user", JSON.stringify(currentUser));
      } catch (err) {
        console.warn("[AuthContext] Session verification failed, attempting renewal...", err);
        // Api interceptor will attempt refresh, or if unrecoverable:
        const currentToken = getAuthToken();
        if (!currentToken) {
          setUser(null);
          setToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for session expiration events dispatched by api interceptor
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener("wayzo:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("wayzo:auth-expired", handleAuthExpired);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await detectionService.login(email, password);
    const { access_token, refresh_token, user: loggedUser } = response;
    setAuthSession(access_token, refresh_token, loggedUser);
    setToken(access_token);
    setUser(loggedUser);
    return loggedUser;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...allowedRoles) => {
      if (!user) return false;
      if (user.role === "admin") return true; // Admin has superuser privileges
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    hasRole,
    role: user?.role || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
