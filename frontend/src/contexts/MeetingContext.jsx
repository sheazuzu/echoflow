/**
 * 会议纪要 Context
 * 管理会议纪要状态（转录文本、纪要数据）
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { PROCESSING_STEPS } from '../constants';

// 创建 Context
const MeetingContext = createContext(null);

// 初始状态
const initialState = {
  // 处理状态
  isProcessing: false,
  processingStep: null,
  processingProgress: 0,
  taskId: null,

  // 转录文本
  transcription: null,
  transcriptionLanguage: 'zh-CN',

  // 会议纪要
  meetingMinutes: null,
  minutesTitle: '',
  minutesDate: null,
  participants: [],

  // 会议内容
  topic: '',
  discussion: '',
  decisions: [],
  actionItems: [],
  nextMeeting: '',

  // 历史记录（未来功能）
  history: [],
};

// Action 类型
const ACTION_TYPES = {
  // 处理操作
  START_PROCESSING: 'START_PROCESSING',
  UPDATE_PROCESSING_STEP: 'UPDATE_PROCESSING_STEP',
  UPDATE_PROCESSING_PROGRESS: 'UPDATE_PROCESSING_PROGRESS',
  PROCESSING_COMPLETED: 'PROCESSING_COMPLETED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  SET_TASK_ID: 'SET_TASK_ID',

  // 转录
  SET_TRANSCRIPTION: 'SET_TRANSCRIPTION',
  SET_TRANSCRIPTION_LANGUAGE: 'SET_TRANSCRIPTION_LANGUAGE',

  // 会议纪要
  SET_MEETING_MINUTES: 'SET_MEETING_MINUTES',
  UPDATE_MINUTES_TITLE: 'UPDATE_MINUTES_TITLE',
  UPDATE_MINUTES_DATE: 'UPDATE_MINUTES_DATE',
  UPDATE_PARTICIPANTS: 'UPDATE_PARTICIPANTS',
  ADD_PARTICIPANT: 'ADD_PARTICIPANT',
  REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',

  // 会议内容
  UPDATE_TOPIC: 'UPDATE_TOPIC',
  UPDATE_DISCUSSION: 'UPDATE_DISCUSSION',
  UPDATE_DECISIONS: 'UPDATE_DECISIONS',
  ADD_DECISION: 'ADD_DECISION',
  REMOVE_DECISION: 'REMOVE_DECISION',
  UPDATE_ACTION_ITEMS: 'UPDATE_ACTION_ITEMS',
  ADD_ACTION_ITEM: 'ADD_ACTION_ITEM',
  REMOVE_ACTION_ITEM: 'REMOVE_ACTION_ITEM',
  UPDATE_NEXT_MEETING: 'UPDATE_NEXT_MEETING',

  // 历史记录
  SET_HISTORY: 'SET_HISTORY',
  ADD_TO_HISTORY: 'ADD_TO_HISTORY',

  // 重置
  RESET: 'RESET',
};

// Reducer
const meetingReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.START_PROCESSING:
      return {
        ...state,
        isProcessing: true,
        processingStep: PROCESSING_STEPS.UPLOADING,
        processingProgress: 0,
      };

    case ACTION_TYPES.UPDATE_PROCESSING_STEP:
      return {
        ...state,
        processingStep: action.payload,
      };

    case ACTION_TYPES.UPDATE_PROCESSING_PROGRESS:
      return {
        ...state,
        processingProgress: action.payload,
      };

    case ACTION_TYPES.PROCESSING_COMPLETED:
      return {
        ...state,
        isProcessing: false,
        processingStep: PROCESSING_STEPS.COMPLETED,
        processingProgress: 100,
      };

    case ACTION_TYPES.PROCESSING_FAILED:
      return {
        ...state,
        isProcessing: false,
        processingStep: null,
        processingProgress: 0,
      };

    case ACTION_TYPES.SET_TASK_ID:
      return {
        ...state,
        taskId: action.payload,
      };

    case ACTION_TYPES.SET_TRANSCRIPTION:
      return {
        ...state,
        transcription: action.payload,
      };

    case ACTION_TYPES.SET_TRANSCRIPTION_LANGUAGE:
      return {
        ...state,
        transcriptionLanguage: action.payload,
      };

    case ACTION_TYPES.SET_MEETING_MINUTES:
      return {
        ...state,
        meetingMinutes: action.payload,
        minutesTitle: action.payload.title || '',
        minutesDate: action.payload.date || new Date().toISOString(),
        participants: action.payload.participants || [],
        topic: action.payload.content?.topic || '',
        discussion: action.payload.content?.discussion || '',
        decisions: action.payload.content?.decisions || [],
        actionItems: action.payload.content?.actionItems || [],
        nextMeeting: action.payload.content?.nextMeeting || '',
      };

    case ACTION_TYPES.UPDATE_MINUTES_TITLE:
      return {
        ...state,
        minutesTitle: action.payload,
      };

    case ACTION_TYPES.UPDATE_MINUTES_DATE:
      return {
        ...state,
        minutesDate: action.payload,
      };

    case ACTION_TYPES.UPDATE_PARTICIPANTS:
      return {
        ...state,
        participants: action.payload,
      };

    case ACTION_TYPES.ADD_PARTICIPANT:
      return {
        ...state,
        participants: [...state.participants, action.payload],
      };

    case ACTION_TYPES.REMOVE_PARTICIPANT:
      return {
        ...state,
        participants: state.participants.filter((_, index) => index !== action.payload),
      };

    case ACTION_TYPES.UPDATE_TOPIC:
      return {
        ...state,
        topic: action.payload,
      };

    case ACTION_TYPES.UPDATE_DISCUSSION:
      return {
        ...state,
        discussion: action.payload,
      };

    case ACTION_TYPES.UPDATE_DECISIONS:
      return {
        ...state,
        decisions: action.payload,
      };

    case ACTION_TYPES.ADD_DECISION:
      return {
        ...state,
        decisions: [...state.decisions, action.payload],
      };

    case ACTION_TYPES.REMOVE_DECISION:
      return {
        ...state,
        decisions: state.decisions.filter((_, index) => index !== action.payload),
      };

    case ACTION_TYPES.UPDATE_ACTION_ITEMS:
      return {
        ...state,
        actionItems: action.payload,
      };

    case ACTION_TYPES.ADD_ACTION_ITEM:
      return {
        ...state,
        actionItems: [...state.actionItems, action.payload],
      };

    case ACTION_TYPES.REMOVE_ACTION_ITEM:
      return {
        ...state,
        actionItems: state.actionItems.filter((_, index) => index !== action.payload),
      };

    case ACTION_TYPES.UPDATE_NEXT_MEETING:
      return {
        ...state,
        nextMeeting: action.payload,
      };

    case ACTION_TYPES.SET_HISTORY:
      return {
        ...state,
        history: action.payload,
      };

    case ACTION_TYPES.ADD_TO_HISTORY:
      return {
        ...state,
        history: [action.payload, ...state.history],
      };

    case ACTION_TYPES.RESET:
      return initialState;

    default:
      return state;
  }
};

/**
 * Meeting Provider 组件
 */
export const MeetingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(meetingReducer, initialState);

  // 处理操作
  const startProcessing = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_PROCESSING });
  }, []);

  const updateProcessingStep = useCallback((step) => {
    dispatch({ type: ACTION_TYPES.UPDATE_PROCESSING_STEP, payload: step });
  }, []);

  const updateProcessingProgress = useCallback((progress) => {
    dispatch({ type: ACTION_TYPES.UPDATE_PROCESSING_PROGRESS, payload: progress });
  }, []);

  const processingCompleted = useCallback(() => {
    dispatch({ type: ACTION_TYPES.PROCESSING_COMPLETED });
  }, []);

  const processingFailed = useCallback(() => {
    dispatch({ type: ACTION_TYPES.PROCESSING_FAILED });
  }, []);

  const setTaskId = useCallback((id) => {
    dispatch({ type: ACTION_TYPES.SET_TASK_ID, payload: id });
  }, []);

  // 转录
  const setTranscription = useCallback((text) => {
    dispatch({ type: ACTION_TYPES.SET_TRANSCRIPTION, payload: text });
  }, []);

  const setTranscriptionLanguage = useCallback((language) => {
    dispatch({ type: ACTION_TYPES.SET_TRANSCRIPTION_LANGUAGE, payload: language });
  }, []);

  // 会议纪要
  const setMeetingMinutes = useCallback((minutes) => {
    dispatch({ type: ACTION_TYPES.SET_MEETING_MINUTES, payload: minutes });
  }, []);

  const updateMinutesTitle = useCallback((title) => {
    dispatch({ type: ACTION_TYPES.UPDATE_MINUTES_TITLE, payload: title });
  }, []);

  const updateMinutesDate = useCallback((date) => {
    dispatch({ type: ACTION_TYPES.UPDATE_MINUTES_DATE, payload: date });
  }, []);

  const updateParticipants = useCallback((participants) => {
    dispatch({ type: ACTION_TYPES.UPDATE_PARTICIPANTS, payload: participants });
  }, []);

  const addParticipant = useCallback((participant) => {
    dispatch({ type: ACTION_TYPES.ADD_PARTICIPANT, payload: participant });
  }, []);

  const removeParticipant = useCallback((index) => {
    dispatch({ type: ACTION_TYPES.REMOVE_PARTICIPANT, payload: index });
  }, []);

  // 会议内容
  const updateTopic = useCallback((topic) => {
    dispatch({ type: ACTION_TYPES.UPDATE_TOPIC, payload: topic });
  }, []);

  const updateDiscussion = useCallback((discussion) => {
    dispatch({ type: ACTION_TYPES.UPDATE_DISCUSSION, payload: discussion });
  }, []);

  const updateDecisions = useCallback((decisions) => {
    dispatch({ type: ACTION_TYPES.UPDATE_DECISIONS, payload: decisions });
  }, []);

  const addDecision = useCallback((decision) => {
    dispatch({ type: ACTION_TYPES.ADD_DECISION, payload: decision });
  }, []);

  const removeDecision = useCallback((index) => {
    dispatch({ type: ACTION_TYPES.REMOVE_DECISION, payload: index });
  }, []);

  const updateActionItems = useCallback((items) => {
    dispatch({ type: ACTION_TYPES.UPDATE_ACTION_ITEMS, payload: items });
  }, []);

  const addActionItem = useCallback((item) => {
    dispatch({ type: ACTION_TYPES.ADD_ACTION_ITEM, payload: item });
  }, []);

  const removeActionItem = useCallback((index) => {
    dispatch({ type: ACTION_TYPES.REMOVE_ACTION_ITEM, payload: index });
  }, []);

  const updateNextMeeting = useCallback((nextMeeting) => {
    dispatch({ type: ACTION_TYPES.UPDATE_NEXT_MEETING, payload: nextMeeting });
  }, []);

  // 历史记录
  const setHistory = useCallback((history) => {
    dispatch({ type: ACTION_TYPES.SET_HISTORY, payload: history });
  }, []);

  const addToHistory = useCallback((item) => {
    dispatch({ type: ACTION_TYPES.ADD_TO_HISTORY, payload: item });
  }, []);

  // 重置
  const reset = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET });
  }, []);

  const value = {
    // 状态
    ...state,

    // 处理操作
    startProcessing,
    updateProcessingStep,
    updateProcessingProgress,
    processingCompleted,
    processingFailed,
    setTaskId,

    // 转录
    setTranscription,
    setTranscriptionLanguage,

    // 会议纪要
    setMeetingMinutes,
    updateMinutesTitle,
    updateMinutesDate,
    updateParticipants,
    addParticipant,
    removeParticipant,

    // 会议内容
    updateTopic,
    updateDiscussion,
    updateDecisions,
    addDecision,
    removeDecision,
    updateActionItems,
    addActionItem,
    removeActionItem,
    updateNextMeeting,

    // 历史记录
    setHistory,
    addToHistory,

    // 重置
    reset,
  };

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  );
};

/**
 * 使用 Meeting 的 Hook
 */
export const useMeeting = () => {
  const context = useContext(MeetingContext);

  if (!context) {
    throw new Error('useMeeting must be used within MeetingProvider');
  }

  return context;
};

export default MeetingContext;
