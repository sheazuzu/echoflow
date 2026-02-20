/**
 * 通知 Context
 * 管理通知和错误消息
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { NOTIFICATION_TYPES, TIME_CONFIG } from '../constants';

// 创建 Context
const NotificationContext = createContext(null);

// 初始状态
const initialState = {
  notifications: [],
  nextId: 1,
};

// Action 类型
const ACTION_TYPES = {
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_ALL: 'CLEAR_ALL',
};

// Reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, { ...action.payload, id: state.nextId }],
        nextId: state.nextId + 1,
      };

    case ACTION_TYPES.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    case ACTION_TYPES.CLEAR_ALL:
      return {
        ...state,
        notifications: [],
      };

    default:
      return state;
  }
};

/**
 * Notification Provider 组件
 */
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  // 添加通知
  const addNotification = useCallback((message, type = NOTIFICATION_TYPES.INFO, duration = TIME_CONFIG.NOTIFICATION_DURATION) => {
    const notification = {
      message,
      type,
      duration,
      timestamp: Date.now(),
    };

    dispatch({ type: ACTION_TYPES.ADD_NOTIFICATION, payload: notification });

    // 自动移除通知
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(state.nextId);
      }, duration);
    }

    return state.nextId;
  }, [state.nextId]);

  // 移除通知
  const removeNotification = useCallback((id) => {
    dispatch({ type: ACTION_TYPES.REMOVE_NOTIFICATION, payload: id });
  }, []);

  // 清除所有通知
  const clearAll = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_ALL });
  }, []);

  // 便捷方法
  const success = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
  }, [addNotification]);

  const error = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.ERROR, duration);
  }, [addNotification]);

  const warning = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.WARNING, duration);
  }, [addNotification]);

  const info = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.INFO, duration);
  }, [addNotification]);

  const value = {
    // 状态
    notifications: state.notifications,

    // 操作
    addNotification,
    removeNotification,
    clearAll,

    // 便捷方法
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * 使用 Notification 的 Hook
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }

  return context;
};

export default NotificationContext;
