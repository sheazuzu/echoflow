/**
 * 应用状态 Context
 * 管理全局应用状态（idle/recording/processing/completed）
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { APP_STATES } from '../constants';

// 创建 Context
const AppStateContext = createContext(null);

// 初始状态
const initialState = {
  currentState: APP_STATES.IDLE,
  previousState: null,
  error: null,
  isLoading: false,
};

// Action 类型
const ACTION_TYPES = {
  SET_STATE: 'SET_STATE',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_LOADING: 'SET_LOADING',
  RESET: 'RESET',
};

// Reducer
const appStateReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.SET_STATE:
      return {
        ...state,
        currentState: action.payload,
        previousState: state.currentState,
        error: null,
      };

    case ACTION_TYPES.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        currentState: APP_STATES.ERROR,
      };

    case ACTION_TYPES.CLEAR_ERROR:
      return {
        ...state,
        error: null,
        currentState: state.previousState || APP_STATES.IDLE,
      };

    case ACTION_TYPES.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case ACTION_TYPES.RESET:
      return initialState;

    default:
      return state;
  }
};

/**
 * AppState Provider 组件
 */
export const AppStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  // 设置应用状态
  const setState = useCallback((newState) => {
    dispatch({ type: ACTION_TYPES.SET_STATE, payload: newState });
  }, []);

  // 设置错误
  const setError = useCallback((error) => {
    dispatch({ type: ACTION_TYPES.SET_ERROR, payload: error });
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_ERROR });
  }, []);

  // 设置加载状态
  const setLoading = useCallback((isLoading) => {
    dispatch({ type: ACTION_TYPES.SET_LOADING, payload: isLoading });
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET });
  }, []);

  // 状态检查辅助函数
  const isIdle = state.currentState === APP_STATES.IDLE;
  const isRecording = state.currentState === APP_STATES.RECORDING;
  const isUploading = state.currentState === APP_STATES.UPLOADING;
  const isProcessing = state.currentState === APP_STATES.PROCESSING;
  const isCompleted = state.currentState === APP_STATES.COMPLETED;
  const isError = state.currentState === APP_STATES.ERROR;

  const value = {
    // 状态
    currentState: state.currentState,
    previousState: state.previousState,
    error: state.error,
    isLoading: state.isLoading,

    // 状态检查
    isIdle,
    isRecording,
    isUploading,
    isProcessing,
    isCompleted,
    isError,

    // 操作
    setState,
    setError,
    clearError,
    setLoading,
    reset,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

/**
 * 使用 AppState 的 Hook
 */
export const useAppState = () => {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
};

export default AppStateContext;
