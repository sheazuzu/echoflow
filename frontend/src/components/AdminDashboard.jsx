import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdminDashboard } from '../services/adminService';
import './AdminDashboard.css';

const PAGE_SIZE = 20;
const ACCESS_INITIAL_VISIBLE = 50;
const ACCESS_PAGE_STEP = 50;
const EXCERPT_PREVIEW_LENGTH = 120;
const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
const FRESHNESS_TICK_INTERVAL_MS = 30 * 1000;

const ACTION_LABELS = {
  login: '登录',
  logout: '登出',
  dashboard_view: '查看面板',
};

const SOURCE_OPTIONS = [
  { value: 'all', label: '全部来源' },
  { value: 'realtime_summary', label: '网页实时总结' },
  { value: 'upload', label: '音频上传处理' },
];

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

const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return '尚未更新';
  }
  const diff = Date.now() - timestamp;
  if (diff < 0) {
    return '刚刚';
  }
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) {
    return '刚刚';
  }
  if (seconds < 60) {
    return `${seconds} 秒前`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
};

const formatTimestampForFilename = (timestamp) => {
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
};

const escapeCsvField = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const triggerDownload = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

const getSourceLabel = (source) => {
  if (source === 'realtime_summary') return '网页实时总结';
  if (source === 'upload') return '音频上传处理';
  return source || '未知来源';
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [viewerInfo, setViewerInfo] = useState(null);

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 摘要展开状态
  const [expandedExcerpts, setExpandedExcerpts] = useState(() => new Set());

  // 详情抽屉
  const [selectedRecord, setSelectedRecord] = useState(null);

  // 访问活动可见数量
  const [accessVisibleCount, setAccessVisibleCount] = useState(ACCESS_INITIAL_VISIBLE);

  // 自动刷新与新鲜度
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [, setFreshnessTick] = useState(0);

  const dashboardRef = useRef(null);
  dashboardRef.current = dashboard;

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    const startedAt = Date.now();

    if (!silent) {
      setLoading(true);
    }
    setErrorMessage('');

    console.info('[ADMIN_DASHBOARD] 开始加载管理页数据', {
      startedAt: new Date(startedAt).toISOString(),
      silent,
    });

    try {
      const dashboardResponse = await getAdminDashboard();

      console.info('[ADMIN_DASHBOARD] 收到管理页响应', dashboardResponse);

      if (!dashboardResponse?.success) {
        if (!silent) {
          setDashboard(null);
          setViewerInfo(null);
        }
        setErrorMessage(dashboardResponse?.message || '加载管理页数据失败');
        setLoading(false);

        console.error('[ADMIN_DASHBOARD] 加载失败', {
          elapsedMs: Date.now() - startedAt,
          response: dashboardResponse,
          silent,
        });
        return;
      }

      setDashboard(dashboardResponse.data);
      setViewerInfo(dashboardResponse.data?.actor || null);
      setLastUpdatedAt(Date.now());
      setLoading(false);

      console.info('[ADMIN_DASHBOARD] 加载成功', {
        elapsedMs: Date.now() - startedAt,
        summaryCount: dashboardResponse.data?.summaryRecords?.length || 0,
        silent,
      });
    } catch (error) {
      if (!silent) {
        setDashboard(null);
        setViewerInfo(null);
      }
      setErrorMessage(error?.message || '加载管理页数据失败');
      setLoading(false);

      console.error('[ADMIN_DASHBOARD] 加载过程中发生未捕获异常', {
        elapsedMs: Date.now() - startedAt,
        error,
        silent,
      });
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // 自动刷新定时器
  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    console.info('[ADMIN_DASHBOARD] 启用自动刷新', { intervalMs: AUTO_REFRESH_INTERVAL_MS });
    const timer = setInterval(() => {
      loadDashboard({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      console.info('[ADMIN_DASHBOARD] 关闭自动刷新');
      clearInterval(timer);
    };
  }, [autoRefresh, loadDashboard]);

  // 数据新鲜度刷新（让相对时间持续更新）
  useEffect(() => {
    const timer = setInterval(() => {
      setFreshnessTick((prev) => prev + 1);
    }, FRESHNESS_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Esc 键关闭详情抽屉
  useEffect(() => {
    if (!selectedRecord) {
      return undefined;
    }
    const handler = (event) => {
      if (event.key === 'Escape') {
        setSelectedRecord(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedRecord]);

  // 概览卡片
  const overviewCards = useMemo(() => {
    const overview = dashboard?.overview;
    if (!overview || Object.keys(overview).length === 0) {
      return [];
    }

    const cards = [
      { label: '最近 7 天总结数', value: overview.summaryCount ?? 0 },
      { label: '生成总结的使用者', value: overview.uniqueSummaryUsers ?? 0 },
      { label: '管理页访问次数', value: overview.accessCount ?? 0 },
      { label: '管理页独立访客数', value: overview.uniqueAdminVisitors ?? 0 },
    ];

    if ((overview.failedLoginCount ?? 0) > 0) {
      cards.push({
        label: '登录失败次数',
        value: overview.failedLoginCount,
        warn: true,
      });
    }

    return cards;
  }, [dashboard]);

  // 使用者下拉项
  const availableUsers = useMemo(() => {
    const records = dashboard?.summaryRecords || [];
    const map = new Map();
    records.forEach((record) => {
      const id = record.requester?.clientId;
      if (!id || map.has(id)) return;
      map.set(id, record.requester?.clientLabel || record.userDisplayName || id);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [dashboard]);

  // 筛选后的总结记录
  const filteredSummaries = useMemo(() => {
    const records = dashboard?.summaryRecords || [];
    const trimmedKeyword = keyword.trim().toLowerCase();

    return records.filter((record) => {
      if (sourceFilter !== 'all' && record.source !== sourceFilter) {
        return false;
      }
      if (userFilter !== 'all' && record.requester?.clientId !== userFilter) {
        return false;
      }
      if (trimmedKeyword) {
        const haystack = [
          record.meetingTitle,
          record.meetingTopic,
          record.originalFilename,
          record.summaryExcerpt,
          record.userDisplayName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(trimmedKeyword)) {
          return false;
        }
      }
      return true;
    });
  }, [dashboard, keyword, sourceFilter, userFilter]);

  // 筛选条件变化时重置分页
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, sourceFilter, userFilter]);

  // 分页后的记录
  const totalPages = Math.max(1, Math.ceil(filteredSummaries.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedSummaries = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredSummaries.slice(start, start + PAGE_SIZE);
  }, [filteredSummaries, safeCurrentPage]);

  const handleClearFilters = useCallback(() => {
    console.info('[ADMIN_DASHBOARD] 清除筛选条件');
    setKeyword('');
    setSourceFilter('all');
    setUserFilter('all');
  }, []);

  const toggleExcerpt = useCallback((id) => {
    setExpandedExcerpts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExportJson = useCallback(() => {
    if (filteredSummaries.length === 0) {
      setErrorMessage('没有可导出的记录');
      return;
    }
    const filename = `echoflow-summaries-${formatTimestampForFilename(Date.now())}.json`;
    const content = JSON.stringify(filteredSummaries, null, 2);
    triggerDownload(filename, content, 'application/json;charset=utf-8');
    console.info('[ADMIN_DASHBOARD] 导出 JSON', { filename, count: filteredSummaries.length });
  }, [filteredSummaries]);

  const handleExportCsv = useCallback(() => {
    if (filteredSummaries.length === 0) {
      setErrorMessage('没有可导出的记录');
      return;
    }
    const headers = [
      'createdAt',
      'meetingTitle',
      'meetingDate',
      'meetingTopic',
      'source',
      'userDisplayName',
      'originalFilename',
      'summaryExcerpt',
      'requesterIp',
    ];
    const rows = filteredSummaries.map((record) => [
      record.createdAt || '',
      record.meetingTitle || '',
      record.meetingDate || '',
      record.meetingTopic || '',
      getSourceLabel(record.source),
      record.userDisplayName || '',
      record.originalFilename || '',
      record.summaryExcerpt || '',
      record.requester?.ip || '',
    ]);
    const csvLines = [headers.join(',')];
    rows.forEach((row) => {
      csvLines.push(row.map(escapeCsvField).join(','));
    });
    // 加 BOM 以保证 Excel 识别 UTF-8
    const csvContent = `\ufeff${csvLines.join('\r\n')}`;
    const filename = `echoflow-summaries-${formatTimestampForFilename(Date.now())}.csv`;
    triggerDownload(filename, csvContent, 'text/csv;charset=utf-8');
    console.info('[ADMIN_DASHBOARD] 导出 CSV', { filename, count: filteredSummaries.length });
  }, [filteredSummaries]);

  const handleOpenDetail = useCallback((record) => {
    console.info('[ADMIN_DASHBOARD] 打开详情', { id: record?.id });
    setSelectedRecord(record);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRecord(null);
  }, []);

  const visibleAccessRecords = useMemo(() => {
    const records = dashboard?.accessRecords || [];
    return records.slice(0, accessVisibleCount);
  }, [dashboard, accessVisibleCount]);

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

  const hasFilters = keyword.trim() !== '' || sourceFilter !== 'all' || userFilter !== 'all';
  const hasSummaryRecords = (dashboard?.summaryRecords?.length || 0) > 0;
  const accessRecords = dashboard?.accessRecords || [];

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
          <button className="admin-action-button" onClick={() => loadDashboard()} disabled={loading}>
            {loading ? '刷新中…' : '刷新数据'}
          </button>
          <button
            className="admin-secondary-button"
            onClick={handleExportJson}
            disabled={filteredSummaries.length === 0}
          >
            导出 JSON
          </button>
          <button
            className="admin-secondary-button"
            onClick={handleExportCsv}
            disabled={filteredSummaries.length === 0}
          >
            导出 CSV
          </button>
          <label className="admin-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            <span>自动刷新（60秒）</span>
          </label>
          <span className="admin-freshness">上次更新：{formatRelativeTime(lastUpdatedAt)}</span>
        </div>

        {errorMessage && <div className="admin-error-box">{errorMessage}</div>}

        {overviewCards.length > 0 && (
          <div className="admin-grid">
            {overviewCards.map((card) => (
              <div
                key={card.label}
                className={`admin-card${card.warn ? ' admin-card-warn' : ''}`}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="admin-sections">
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>会议总结记录</h2>
                <p>按时间倒序展示最近 7 天生成的会议总结和摘要。</p>
              </div>
            </div>

            <div className="admin-filter-bar">
              <input
                type="text"
                className="admin-filter-input"
                placeholder="搜索标题 / 主题 / 文件名 / 摘要 / 使用者"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <select
                className="admin-filter-select"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="admin-filter-select"
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
              >
                <option value="all">全部使用者</option>
                {availableUsers.map((user) => (
                  <option key={user.value} value={user.value}>
                    {user.label}
                  </option>
                ))}
              </select>
              <button
                className="admin-secondary-button"
                onClick={handleClearFilters}
                disabled={!hasFilters}
              >
                清除筛选
              </button>
              <span className="admin-filter-count">
                共 {filteredSummaries.length} / {dashboard?.summaryRecords?.length || 0} 条
              </span>
            </div>

            {hasSummaryRecords && filteredSummaries.length > 0 ? (
              <>
                <div className="admin-summary-list">
                  {pagedSummaries.map((record) => {
                    const excerpt = record.summaryExcerpt || '';
                    const needsCollapse = excerpt.length > EXCERPT_PREVIEW_LENGTH;
                    const isExpanded = expandedExcerpts.has(record.id);
                    const displayExcerpt = needsCollapse && !isExpanded
                      ? `${excerpt.slice(0, EXCERPT_PREVIEW_LENGTH)}…`
                      : excerpt;

                    return (
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
                          {record.summarySnapshot?.decisionsCount > 0 && (
                            <span className="admin-badge">决策：{record.summarySnapshot.decisionsCount}</span>
                          )}
                          {record.summarySnapshot?.actionItemCount > 0 && (
                            <span className="admin-badge">行动项：{record.summarySnapshot.actionItemCount}</span>
                          )}
                        </div>

                        <p className="admin-summary-excerpt">
                          {displayExcerpt || '该条记录暂无可展示摘要。'}
                          {needsCollapse && (
                            <button
                              type="button"
                              className="admin-link-button"
                              onClick={() => toggleExcerpt(record.id)}
                            >
                              {isExpanded ? '收起' : '展开'}
                            </button>
                          )}
                        </p>

                        <div className="admin-summary-footer">
                          <span>
                            访问标识：{record.requester?.clientLabel || '未知访客'}
                            {record.requester?.ip ? ` · IP：${record.requester.ip}` : ''}
                          </span>
                          <button
                            type="button"
                            className="admin-link-button"
                            onClick={() => handleOpenDetail(record)}
                          >
                            查看完整总结
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {filteredSummaries.length > PAGE_SIZE && (
                  <div className="admin-pagination">
                    <button
                      className="admin-secondary-button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                    >
                      上一页
                    </button>
                    <span className="admin-pagination-info">
                      第 {safeCurrentPage} / {totalPages} 页
                    </span>
                    <button
                      className="admin-secondary-button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            ) : hasSummaryRecords ? (
              <div className="admin-empty">没有匹配的记录，请尝试调整筛选条件。</div>
            ) : (
              <div className="admin-empty">最近 7 天还没有可展示的会议总结记录。</div>
            )}
          </section>

          {accessRecords.length > 0 && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h2>访问活动</h2>
                  <p>最近 7 天的管理页访问与登录记录。</p>
                </div>
              </div>

              <div className="admin-access-list">
                {visibleAccessRecords.map((record) => (
                  <article key={record.id} className="admin-access-item">
                    <div className="admin-access-top">
                      <div className="admin-access-title">
                        {ACTION_LABELS[record.action] || record.action}
                      </div>
                      <div className="admin-timestamp">{formatDateTime(record.createdAt)}</div>
                    </div>

                    <div className="admin-access-meta">
                      <span className={`admin-badge ${record.success ? 'success' : 'error'}`}>
                        {record.success ? '成功' : '失败'}
                      </span>
                      {!record.success && record.reason && (
                        <span className="admin-badge error">原因：{record.reason}</span>
                      )}
                      <span className="admin-badge">
                        访客：{record.requester?.clientLabel || '未知访客'}
                      </span>
                      {record.requester?.ip && (
                        <span className="admin-badge">IP：{record.requester.ip}</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {accessRecords.length > accessVisibleCount && (
                <div className="admin-pagination">
                  <button
                    className="admin-secondary-button"
                    onClick={() => setAccessVisibleCount((c) => c + ACCESS_PAGE_STEP)}
                  >
                    显示更多（剩余 {accessRecords.length - accessVisibleCount} 条）
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {selectedRecord && (
        <div className="admin-drawer-mask" onClick={handleCloseDetail}>
          <div
            className="admin-drawer"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-drawer-header">
              <h2>{selectedRecord.meetingTitle || '未命名会议'}</h2>
              <button
                type="button"
                className="admin-drawer-close"
                onClick={handleCloseDetail}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="admin-drawer-body">
              <div className="admin-summary-meta">
                <span className="admin-badge">{formatDateTime(selectedRecord.createdAt)}</span>
                <span className="admin-badge">来源：{getSourceLabel(selectedRecord.source)}</span>
                {selectedRecord.userDisplayName && (
                  <span className="admin-badge">使用者：{selectedRecord.userDisplayName}</span>
                )}
                {selectedRecord.meetingDate && (
                  <span className="admin-badge">会议日期：{selectedRecord.meetingDate}</span>
                )}
                {selectedRecord.summarySnapshot?.keyDiscussionCount > 0 && (
                  <span className="admin-badge">
                    讨论点：{selectedRecord.summarySnapshot.keyDiscussionCount}
                  </span>
                )}
                {selectedRecord.summarySnapshot?.decisionsCount > 0 && (
                  <span className="admin-badge">
                    决策：{selectedRecord.summarySnapshot.decisionsCount}
                  </span>
                )}
                {selectedRecord.summarySnapshot?.actionItemCount > 0 && (
                  <span className="admin-badge">
                    行动项：{selectedRecord.summarySnapshot.actionItemCount}
                  </span>
                )}
              </div>

              {selectedRecord.summarySnapshot?.chinese && (
                <div className="admin-drawer-section">
                  <h3>中文总结</h3>
                  {selectedRecord.summarySnapshot.chinese.title && (
                    <p><strong>标题：</strong>{selectedRecord.summarySnapshot.chinese.title}</p>
                  )}
                  {selectedRecord.summarySnapshot.chinese.date && (
                    <p><strong>日期：</strong>{selectedRecord.summarySnapshot.chinese.date}</p>
                  )}
                  {selectedRecord.summarySnapshot.chinese.attendees?.length > 0 && (
                    <p>
                      <strong>参会人：</strong>
                      {selectedRecord.summarySnapshot.chinese.attendees.join('、')}
                    </p>
                  )}
                  {selectedRecord.summarySnapshot.chinese.summary && (
                    <p className="admin-drawer-text">
                      {selectedRecord.summarySnapshot.chinese.summary}
                    </p>
                  )}
                </div>
              )}

              {selectedRecord.summarySnapshot?.english && (
                <div className="admin-drawer-section">
                  <h3>English Summary</h3>
                  {selectedRecord.summarySnapshot.english.title && (
                    <p><strong>Title: </strong>{selectedRecord.summarySnapshot.english.title}</p>
                  )}
                  {selectedRecord.summarySnapshot.english.date && (
                    <p><strong>Date: </strong>{selectedRecord.summarySnapshot.english.date}</p>
                  )}
                  {selectedRecord.summarySnapshot.english.attendees?.length > 0 && (
                    <p>
                      <strong>Attendees: </strong>
                      {selectedRecord.summarySnapshot.english.attendees.join(', ')}
                    </p>
                  )}
                  {selectedRecord.summarySnapshot.english.summary && (
                    <p className="admin-drawer-text">
                      {selectedRecord.summarySnapshot.english.summary}
                    </p>
                  )}
                </div>
              )}

              <div className="admin-drawer-section">
                <h3>访客信息</h3>
                <p><strong>标识：</strong>{selectedRecord.requester?.clientLabel || '未知访客'}</p>
                <p><strong>IP：</strong>{selectedRecord.requester?.ip || '未知'}</p>
                <p><strong>User-Agent：</strong>{selectedRecord.requester?.userAgent || '未知'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}