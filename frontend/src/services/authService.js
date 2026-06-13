import apiClient from './api';

const AUTH_TOKEN_KEY = 'auth_token';

export const saveAuthToken = (token) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const login = async ({ email, password }) => {
  const response = await apiClient.post('/api/auth/login', { email, password }, { retryCount: 0 });
  if (response.success && response.data?.token) {
    saveAuthToken(response.data.token);
  }
  return response;
};

export const register = async ({ name, email, password }) => {
  const response = await apiClient.post('/api/auth/register', { name, email, password }, { retryCount: 0 });
  if (response.success && response.data?.token) {
    saveAuthToken(response.data.token);
  }
  return response;
};

export const logout = async () => {
  const response = await apiClient.post('/api/auth/logout', {}, { retryCount: 0 });
  clearAuthToken();
  return response;
};

export const getCurrentUser = async () => {
  return await apiClient.get('/api/auth/me', { retryCount: 0 });
};
