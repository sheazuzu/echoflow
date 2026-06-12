import apiClient from './api';

const ADMIN_BASE = '/api/admin';

export const getAdminDashboard = async () => {
  return await apiClient.get(`${ADMIN_BASE}/dashboard`, { retryCount: 0 });
};