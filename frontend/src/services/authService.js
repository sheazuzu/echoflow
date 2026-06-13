const AUTH_TOKEN_KEY = 'auth_token';
const CLIENT_ID_STORAGE_KEY = 'echoflow_client_id';

const getOrCreateClientId = () => {
  const existingClientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existingClientId) {
    return existingClientId;
  }

  const newClientId = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, newClientId);
  return newClientId;
};

export const saveAuthToken = (token) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

const authRequest = async (url, body) => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': getOrCreateClientId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data?.message || '认证失败，请稍后重试',
        data,
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      message: error.message || '认证失败，请稍后重试',
      error,
    };
  }
};

export const login = async ({ email, password }) => {
  const response = await authRequest('/api/auth/login', { email, password });
  if (response.success && response.data?.token) {
    saveAuthToken(response.data.token);
  }
  return response;
};

export const register = async ({ name, email, password }) => {
  const response = await authRequest('/api/auth/register', { name, email, password });
  if (response.success && response.data?.token) {
    saveAuthToken(response.data.token);
  }
  return response;
};

export const logout = async () => {
  const response = await authRequest('/api/auth/logout', {});
  clearAuthToken();
  return response;
};

export const getCurrentUser = async () => {
  return await authRequest('/api/auth/me');
};
