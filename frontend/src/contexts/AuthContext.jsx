import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSession = useCallback(async () => {
    const response = await authService.getSession();

    if (response?.success && response?.data?.authenticated) {
      setUser(response.data.user || null);
      return { success: true, user: response.data.user || null };
    }

    setUser(null);
    return { success: Boolean(response?.success), user: null, message: response?.message || '' };
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const response = await authService.getSession();
      if (!active) {
        return;
      }

      if (response?.success && response?.data?.authenticated) {
        setUser(response.data.user || null);
      } else {
        setUser(null);
      }

      setIsReady(true);
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const withLoading = useCallback(async (handler) => {
    setIsLoading(true);
    try {
      return await handler();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((payload) => withLoading(async () => {
    const response = await authService.loginUser(payload);
    if (response?.success && response?.data?.user) {
      setUser(response.data.user);
    }
    return response;
  }), [withLoading]);

  const register = useCallback((payload) => withLoading(async () => {
    const response = await authService.registerUser(payload);
    if (response?.success && response?.data?.user) {
      setUser(response.data.user);
    }
    return response;
  }), [withLoading]);

  const logout = useCallback(() => withLoading(async () => {
    const response = await authService.logoutUser();
    setUser(null);
    return response;
  }), [withLoading]);

  const updateAccountProfile = useCallback((payload) => withLoading(async () => {
    const response = await authService.updateProfile(payload);
    if (response?.success && response?.data?.user) {
      setUser(response.data.user);
    }
    return response;
  }), [withLoading]);

  const updateAccountPassword = useCallback((payload) => withLoading(async () => {
    return authService.changePassword(payload);
  }), [withLoading]);

  const requestPasswordReset = useCallback((payload) => withLoading(async () => {
    return authService.forgotPassword(payload);
  }), [withLoading]);

  const resetPasswordWithToken = useCallback((payload) => withLoading(async () => {
    return authService.resetPassword(payload);
  }), [withLoading]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isReady,
    isLoading,
    login,
    register,
    logout,
    refreshSession,
    updateAccountProfile,
    updateAccountPassword,
    requestPasswordReset,
    resetPasswordWithToken,
  }), [
    user,
    isReady,
    isLoading,
    login,
    register,
    logout,
    refreshSession,
    updateAccountProfile,
    updateAccountPassword,
    requestPasswordReset,
    resetPasswordWithToken,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;