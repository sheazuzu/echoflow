/**
 * 基础 API 客户端
 * 提供统一的请求拦截器、错误处理和重试机制
 */

import { ERROR_MESSAGES, TIME_CONFIG } from '../constants';

// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * HTTP 请求方法
 */
const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
};

/**
 * 请求配置
 */
const DEFAULT_CONFIG = {
  timeout: TIME_CONFIG.REQUEST_TIMEOUT,
  retryCount: 3,
  retryDelay: 1000,
};

/**
 * 创建请求头
 */
const createHeaders = (customHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // 如果有认证 Token，添加到请求头（为未来用户系统准备）
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * 处理响应
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = new Error();
    error.status = response.status;
    error.statusText = response.statusText;

    try {
      const errorData = await response.json();
      error.message = errorData.message || ERROR_MESSAGES.SERVER_ERROR;
      error.data = errorData;
    } catch {
      error.message = ERROR_MESSAGES.SERVER_ERROR;
    }

    throw error;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};

/**
 * 处理错误
 */
const handleError = (error) => {
  if (import.meta.env.DEV) {
    console.error('API Error:', error);
  }

  // 网络错误
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    return {
      success: false,
      message: ERROR_MESSAGES.NETWORK_ERROR,
      error,
    };
  }

  // 超时错误
  if (error.name === 'AbortError') {
    return {
      success: false,
      message: ERROR_MESSAGES.TIMEOUT_ERROR,
      error,
    };
  }

  // HTTP 错误
  if (error.status) {
    let message = ERROR_MESSAGES.SERVER_ERROR;

    switch (error.status) {
      case 400:
        message = error.message || '请求参数错误';
        break;
      case 401:
        message = '未授权，请登录';
        break;
      case 403:
        message = '没有权限访问';
        break;
      case 404:
        message = '请求的资源不存在';
        break;
      case 413:
        message = ERROR_MESSAGES.FILE_TOO_LARGE;
        break;
      case 500:
        message = ERROR_MESSAGES.SERVER_ERROR;
        break;
      case 503:
        message = '服务暂时不可用，请稍后重试';
        break;
      default:
        message = error.message || ERROR_MESSAGES.SERVER_ERROR;
    }

    return {
      success: false,
      message,
      status: error.status,
      error,
    };
  }

  // 未知错误
  return {
    success: false,
    message: error.message || ERROR_MESSAGES.UNKNOWN_ERROR,
    error,
  };
};

/**
 * 延迟函数（用于重试）
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 发送请求（带重试机制）
 */
const request = async (url, options = {}, config = {}) => {
  const {
    timeout = DEFAULT_CONFIG.timeout,
    retryCount = DEFAULT_CONFIG.retryCount,
    retryDelay = DEFAULT_CONFIG.retryDelay,
  } = config;

  let lastError;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return await handleResponse(response);
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试，或者是不应该重试的错误，直接抛出
      if (
        attempt === retryCount ||
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404
      ) {
        throw error;
      }

      // 等待后重试
      if (attempt < retryCount) {
        await delay(retryDelay * (attempt + 1));
      }
    }
  }

  throw lastError;
};

/**
 * API 客户端
 */
const apiClient = {
  /**
   * GET 请求
   */
  get: async (url, config = {}) => {
    try {
      const data = await request(
        url,
        {
          method: HTTP_METHODS.GET,
          headers: createHeaders(),
        },
        config
      );
      return { success: true, data };
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * POST 请求
   */
  post: async (url, body, config = {}) => {
    try {
      const data = await request(
        url,
        {
          method: HTTP_METHODS.POST,
          headers: createHeaders(),
          body: JSON.stringify(body),
        },
        config
      );
      return { success: true, data };
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * PUT 请求
   */
  put: async (url, body, config = {}) => {
    try {
      const data = await request(
        url,
        {
          method: HTTP_METHODS.PUT,
          headers: createHeaders(),
          body: JSON.stringify(body),
        },
        config
      );
      return { success: true, data };
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * DELETE 请求
   */
  delete: async (url, config = {}) => {
    try {
      const data = await request(
        url,
        {
          method: HTTP_METHODS.DELETE,
          headers: createHeaders(),
        },
        config
      );
      return { success: true, data };
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * 上传文件（multipart/form-data）
   */
  upload: async (url, formData, onProgress, config = {}) => {
    try {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // 监听上传进度
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              onProgress(percentComplete);
            }
          });
        }

        // 监听完成
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({ success: true, data });
            } catch {
              resolve({ success: true, data: xhr.responseText });
            }
          } else {
            reject({
              status: xhr.status,
              message: ERROR_MESSAGES.FILE_UPLOAD_FAILED,
            });
          }
        });

        // 监听错误
        xhr.addEventListener('error', () => {
          reject({
            message: ERROR_MESSAGES.NETWORK_ERROR,
          });
        });

        // 监听超时
        xhr.addEventListener('timeout', () => {
          reject({
            message: ERROR_MESSAGES.TIMEOUT_ERROR,
          });
        });

        // 设置超时
        xhr.timeout = config.timeout || DEFAULT_CONFIG.timeout;

        // 发送请求
        xhr.open('POST', `${API_BASE_URL}${url}`);

        // 添加认证头（如果有）
        const token = localStorage.getItem('auth_token');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(formData);
      });
    } catch (error) {
      return handleError(error);
    }
  },
};

export default apiClient;
