/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    setLoading(true);
    const response = await authService.getCurrentUser();
    if (response.success) {
      setUser(response.data.user);
    } else {
      setUser(null);
      authService.clearAuthToken();
    }
    setLoading(false);
    return response;
  };

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      const response = await authService.getCurrentUser();
      if (!active) {
        return;
      }

      if (response.success) {
        setUser(response.data.user);
      } else {
        setUser(null);
        authService.clearAuthToken();
      }
      setLoading(false);
    };

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    if (response.success) {
      setUser(response.data.user);
    }
    return response;
  };

  const register = async (payload) => {
    const response = await authService.register(payload);
    if (response.success) {
      setUser(response.data.user);
    }
    return response;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshUser,
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
