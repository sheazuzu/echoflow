import apiClient from './api';

const AUTH_ENDPOINTS = {
  REGISTER: '/api/auth/register',
  LOGIN: '/api/auth/login',
  SESSION: '/api/auth/session',
  LOGOUT: '/api/auth/logout',
  PROFILE: '/api/auth/profile',
  CHANGE_PASSWORD: '/api/auth/password/change',
  FORGOT_PASSWORD: '/api/auth/password/forgot',
  RESET_PASSWORD: '/api/auth/password/reset',
};

const HISTORY_ENDPOINTS = {
  LIST: '/api/history',
  ANALYTICS: '/api/history/analytics',
  ADMIN_DASHBOARD: '/api/admin/dashboard',
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const registerUser = (payload) => apiClient.post(AUTH_ENDPOINTS.REGISTER, payload, { retryCount: 0 });
export const loginUser = (payload) => apiClient.post(AUTH_ENDPOINTS.LOGIN, payload, { retryCount: 0 });
export const getSession = () => apiClient.get(AUTH_ENDPOINTS.SESSION, { retryCount: 0 });
export const logoutUser = () => apiClient.post(AUTH_ENDPOINTS.LOGOUT, {}, { retryCount: 0 });
export const getProfile = () => apiClient.get(AUTH_ENDPOINTS.PROFILE, { retryCount: 0 });
export const updateProfile = (payload) => apiClient.put(AUTH_ENDPOINTS.PROFILE, payload, { retryCount: 0 });
export const changePassword = (payload) => apiClient.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, payload, { retryCount: 0 });
export const forgotPassword = (payload) => apiClient.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, payload, { retryCount: 0 });
export const resetPassword = (payload) => apiClient.post(AUTH_ENDPOINTS.RESET_PASSWORD, payload, { retryCount: 0 });
export const getHistory = (params = {}) => apiClient.get(`${HISTORY_ENDPOINTS.LIST}${buildQueryString(params)}`, { retryCount: 0 });
export const getHistoryAnalytics = (params = {}) => apiClient.get(`${HISTORY_ENDPOINTS.ANALYTICS}${buildQueryString(params)}`, { retryCount: 0 });
export const getAdminDashboard = (params = {}) => apiClient.get(`${HISTORY_ENDPOINTS.ADMIN_DASHBOARD}${buildQueryString(params)}`, { retryCount: 0 });

export default {
  registerUser,
  loginUser,
  getSession,
  logoutUser,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getHistory,
  getHistoryAnalytics,
  getAdminDashboard,
};