/**
 * HistoryPage - 独立的历史页面
 *
 * 直接使用现有 UserHistoryPage 组件，但提供路由层薄壳，便于以后替换或注入。
 */

import React from 'react';
import UserHistoryPage from '../components/history/UserHistoryPage.jsx';

const HistoryPage = () => {
  return <UserHistoryPage />;
};

export default HistoryPage;
