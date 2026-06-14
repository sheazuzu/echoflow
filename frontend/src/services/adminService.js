import authService from './authService.js';

export const getAdminDashboard = async (params = {}) => {
  return await authService.getAdminDashboard(params);
};