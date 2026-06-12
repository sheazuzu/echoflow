import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminDashboard } from '../services/adminService';
import './AdminDashboard.css';

const formatDateTime = (value) => {
  if (!value) {
    return '未知时间';
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const renderSummaryMeta = (record) => {
  const tags = [
    record.userDisplayName && `使用者：${record.userDisplayName}`,
    record.meetingDate && `会议日期：${record.meetingDate}`,
    record.meetingTopic && `主题：${record.meetingTopic}`,
    record.originalFilename && `文件：${record.originalFilename}`,
    record.source === 'realtime_summary' ? '来源：网页实时总结' : '来源：音频上传处理',
  ].filter(Boolean);

  return tags;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [viewerInfo, setViewerInfo] = useState(null);

  const loadDashboard = useCallback(async () => {
    const startedAt = Date.now();

    setLoading(true);
    setErrorMessage('');

    console.info('[ADMIN_DASHBOARD] 开始加载管理页数据', {
      startedAt: new Date(startedAt).toISOString(),
    });

    try {
      const dashboardResponse = await getAdminDashboard();

      console.info('[ADMIN_DASHBOARD] 收到管理页响应', dashboardResponse);

      if (!dashboardResponse?.success) {
        setDashboard(null);
        setViewerInfo(null);
        setErrorMessage(dashboardResponse?.message || '加载管理页数据失败');
        setLoading(false);

        console.error('[ADMIN_DASHBOARD] 加载失败', {
          elapsedMs: Date.now() - startedAt,
          response: dashboardResponse,
        });
        return;
      }

      setDashboard(dashboardResponse.data);
      setViewerInfo(dashboardResponse.data?.actor || null);
      setLoading(false);

      console.info('[ADMIN_DASHBOARD] 加载成功', {
        elapsedMs: Date.now() - startedAt,
        summaryCount: dashboardResponse.data?.summaryRecords?.length || 0,
      });
    } catch (error) {
      setDashboard(null);
      setViewerInfo(null);
      setErrorMessage(error?.message || '加载管理页数据失败');
      setLoading(false);

      console.error('[ADMIN_DASHBOARD] 加载过程中发生未捕获异常', {
        elapsedMs: Date.now() - startedAt,
        error,
      });
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const overviewCards = useMemo(() => {
    const overview = dashboard?.overview;
    if (!overview) {
      return [];
    }

    return [
      { label: '最近 7 天总结数', value: overview.summaryCount },
      { label: '生成总结的使用者', value: overview.uniqueSummaryUsers },
    ];
  }, [dashboard]);

  if (loading && !dashboard) {
    return (
      <div className="admin-page">
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <h1>Admin Dashboard</h1>
            <p>正在加载最近一周的使用总结…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <div className="admin-hero">
          <div className="admin-title-block">
            <h1>最近一周使用总结</h1>
            <p>这里会展示最近 7 天内谁生成了哪些会议总结以及每条总结的摘要。</p>
          </div>

          <div className="admin-meta">
            {viewerInfo?.clientLabel && (
              <span className="admin-chip">当前访客：{viewerInfo.clientLabel}</span>
            )}
          </div>
        </div>

        <div className="admin-toolbar" style={{ marginBottom: 20 }}>
          <button className="admin-action-button" onClick={loadDashboard} disabled={loading}>
            {loading ? '刷新中…' : '刷新数据'}
          </button>
        </div>

        {errorMessage && <div className="admin-error-box">{errorMessage}</div>}

        <div className="admin-grid">
          {overviewCards.map((card) => (
            <div key={card.label} className="admin-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>

        <div className="admin-sections">
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>会议总结记录</h2>
                <p>按时间倒序展示最近 7 天生成的会议总结和摘要。</p>
              </div>
            </div>

            {dashboard?.summaryRecords?.length ? (
              <div className="admin-summary-list">
                {dashboard.summaryRecords.map((record) => (
                  <article key={record.id} className="admin-summary-item">
                    <div className="admin-summary-top">
                      <div>
                        <div className="admin-summary-title">{record.meetingTitle || '未命名会议'}</div>
                      </div>
                      <div className="admin-timestamp">{formatDateTime(record.createdAt)}</div>
                    </div>

                    <div className="admin-summary-meta">
                      {renderSummaryMeta(record).map((tag) => (
                        <span key={tag} className="admin-badge">{tag}</span>
                      ))}
                      {record.summarySnapshot?.keyDiscussionCount > 0 && (
                        <span className="admin-badge">讨论点：{record.summarySnapshot.keyDiscussionCount}</span>
                      )}
                      {record.summarySnapshot?.actionItemCount > 0 && (
                        <span className="admin-badge">行动项：{record.summarySnapshot.actionItemCount}</span>
                      )}
                    </div>

                    <p className="admin-summary-excerpt">{record.summaryExcerpt || '该条记录暂无可展示摘要。'}</p>

                    <div className="admin-summary-footer">
                      访问标识：{record.requester?.clientLabel || '未知访客'}
                      {record.requester?.ip ? ` · IP：${record.requester.ip}` : ''}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-empty">最近 7 天还没有可展示的会议总结记录。</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}