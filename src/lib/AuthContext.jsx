// EmoSense AI — Independent Authentication Context
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import apiClient from "@/api/apiClient";
import AuthModal from "@/components/auth/AuthModal";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({
    id: "emosense-local",
    public_settings: { auth_required: false },
  });

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const res = await apiClient.auth.me();
      if (res && res.user) {
        setUser(res.user);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      // 401 is normal for anonymous visitors; do not treat as fatal app error
      if (error?.status !== 401) {
        console.warn("[Auth] Session check:", error.message);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setIsLoadingPublicSettings(false);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    await checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = async (email, password) => {
    const res = await apiClient.auth.login({ email, password });
    if (res && res.user) {
      setUser(res.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return res.user;
    }
    return null;
  };

  const register = async (email, password, name) => {
    const res = await apiClient.auth.register({ email, password, name });
    if (res && res.user) {
      setUser(res.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return res.user;
    }
    return null;
  };

  const demoLogin = async () => {
    const res = await apiClient.auth.demoLogin();
    if (res && res.user) {
      setUser(res.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return res.user;
    }
    return null;
  };

  const logout = async () => {
    try {
      await apiClient.auth.logout();
    } catch (err) {
      console.warn("[Auth] Logout cleanup warning:", err.message);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const navigateToLogin = () => setIsAuthModalOpen(true);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authChecked,
        authError,
        appPublicSettings,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        demoLogin,
        logout,
        navigateToLogin,
        checkAppState,
        checkUserAuth,
      }}
    >
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onLogin={login}
        onRegister={register}
        onDemoLogin={demoLogin}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
