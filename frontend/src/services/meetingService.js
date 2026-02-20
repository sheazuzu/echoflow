/**
 * 会议纪要服务
 * 处理会议纪要相关的 API 请求
 */

import apiClient from './api';
import { API_ENDPOINTS } from '../constants';

/**
 * 获取会议纪要
 */
export const getMeetingMinutes = async (taskId) => {
  return await apiClient.get(`${API_ENDPOINTS.GET_MEETING_MINUTES}/${taskId}`);
};

/**
 * 保存会议纪要
 */
export const saveMeetingMinutes = async (minutesData) => {
  const {
    taskId,
    title,
    content,
    participants,
    date,
    tags,
  } = minutesData;

  return await apiClient.post(API_ENDPOINTS.GET_MEETING_MINUTES, {
    taskId,
    title,
    content,
    participants,
    date,
    tags,
  });
};

/**
 * 更新会议纪要
 */
export const updateMeetingMinutes = async (minutesId, updates) => {
  return await apiClient.put(`${API_ENDPOINTS.GET_MEETING_MINUTES}/${minutesId}`, updates);
};

/**
 * 删除会议纪要
 */
export const deleteMeetingMinutes = async (minutesId) => {
  return await apiClient.delete(`${API_ENDPOINTS.GET_MEETING_MINUTES}/${minutesId}`);
};

/**
 * 获取会议历史记录
 */
export const getMeetingHistory = async (params = {}) => {
  const {
    page = 1,
    pageSize = 20,
    sortBy = 'date',
    sortOrder = 'desc',
    search = '',
    tags = [],
  } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    sortBy,
    sortOrder,
    search,
    tags: tags.join(','),
  });

  return await apiClient.get(`${API_ENDPOINTS.GET_HISTORY}?${queryParams}`);
};

/**
 * 搜索会议纪要
 */
export const searchMeetingMinutes = async (keyword) => {
  return await apiClient.get(`${API_ENDPOINTS.GET_MEETING_MINUTES}/search?q=${encodeURIComponent(keyword)}`);
};

/**
 * 导出会议纪要（Markdown 格式）
 */
export const exportToMarkdown = (minutesData) => {
  const {
    title = '会议纪要',
    date = new Date().toLocaleDateString('zh-CN'),
    participants = [],
    content = {},
  } = minutesData;

  let markdown = `# ${title}\n\n`;
  markdown += `**日期：** ${date}\n\n`;

  if (participants.length > 0) {
    markdown += `**参会人员：** ${participants.join('、')}\n\n`;
  }

  markdown += `---\n\n`;

  // 会议主题
  if (content.topic) {
    markdown += `## 会议主题\n\n${content.topic}\n\n`;
  }

  // 讨论内容
  if (content.discussion) {
    markdown += `## 讨论内容\n\n${content.discussion}\n\n`;
  }

  // 决策事项
  if (content.decisions && content.decisions.length > 0) {
    markdown += `## 决策事项\n\n`;
    content.decisions.forEach((decision, index) => {
      markdown += `${index + 1}. ${decision}\n`;
    });
    markdown += `\n`;
  }

  // 行动项
  if (content.actionItems && content.actionItems.length > 0) {
    markdown += `## 行动项\n\n`;
    content.actionItems.forEach((item, index) => {
      markdown += `${index + 1}. ${item.task}`;
      if (item.assignee) {
        markdown += ` - 负责人：${item.assignee}`;
      }
      if (item.deadline) {
        markdown += ` - 截止日期：${item.deadline}`;
      }
      markdown += `\n`;
    });
    markdown += `\n`;
  }

  // 下次会议
  if (content.nextMeeting) {
    markdown += `## 下次会议\n\n${content.nextMeeting}\n\n`;
  }

  return markdown;
};

/**
 * 导出会议纪要（纯文本格式）
 */
export const exportToText = (minutesData) => {
  const {
    title = '会议纪要',
    date = new Date().toLocaleDateString('zh-CN'),
    participants = [],
    content = {},
  } = minutesData;

  let text = `${title}\n\n`;
  text += `日期：${date}\n\n`;

  if (participants.length > 0) {
    text += `参会人员：${participants.join('、')}\n\n`;
  }

  text += `${'='.repeat(50)}\n\n`;

  // 会议主题
  if (content.topic) {
    text += `会议主题\n${content.topic}\n\n`;
  }

  // 讨论内容
  if (content.discussion) {
    text += `讨论内容\n${content.discussion}\n\n`;
  }

  // 决策事项
  if (content.decisions && content.decisions.length > 0) {
    text += `决策事项\n`;
    content.decisions.forEach((decision, index) => {
      text += `${index + 1}. ${decision}\n`;
    });
    text += `\n`;
  }

  // 行动项
  if (content.actionItems && content.actionItems.length > 0) {
    text += `行动项\n`;
    content.actionItems.forEach((item, index) => {
      text += `${index + 1}. ${item.task}`;
      if (item.assignee) {
        text += ` - 负责人：${item.assignee}`;
      }
      if (item.deadline) {
        text += ` - 截止日期：${item.deadline}`;
      }
      text += `\n`;
    });
    text += `\n`;
  }

  // 下次会议
  if (content.nextMeeting) {
    text += `下次会议\n${content.nextMeeting}\n\n`;
  }

  return text;
};

/**
 * 复制到剪贴板
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } else {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        return { success: true };
      } else {
        throw new Error('复制失败');
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || '复制失败',
    };
  }
};

/**
 * 下载会议纪要文件
 */
export const downloadMeetingMinutes = (content, filename, format = 'txt') => {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.message || '下载失败',
    };
  }
};
