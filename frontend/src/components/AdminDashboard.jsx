import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './layout/Header.jsx';
import Footer from './layout/Footer.jsx';
import { getAdminDashboard } from '../services/adminService.js';
import { useTranslation } from '../i18n/index.js';
import './AdminDashboard.css';

const PAGE_SIZE = 20;

const formatDateTime = (value) => {
  if (!value) return '-';
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

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    keyword: '',
    userId: '',
    activityType: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const response = await getAdminDashboard({
      ...filters,
      page: 1,
      pageSize: PAGE_SIZE,
    });

    if (!response?.success) {
      setDashboard(null);
      setErrorMessage(response?.message || t('adminDashboard.messages.loadFailed'));
      setLoading(false);
      return;
    }

    setDashboard(response.data || null);
    setLoading(false);
  }, [filters, t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activityTypeOptions = useMemo(() => ([
    { value: 'all', label: t('history.filters.allTypes') },
    { value: 'upload_task', label: t('history.activityTypes.upload_task') },
    { value: 'video_url_task', label: t('history.activityTypes.video_url_task') },
  ]), [t]);

  const statusOptions = useMemo(() => ([
    { value: 'all', label: t('history.filters.allStatuses') },
    { value: 'processing', label: t('history.statuses.processing') },
    { value: 'completed', label: t('history.statuses.completed') },
    { value: 'failed', label: t('history.statuses.failed') },
    { value: 'cancelled', label: t('history.statuses.cancelled') },
  ]), [t]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ keyword: '', userId: '', activityType: 'all', status: 'all', dateFrom: '', dateTo: '' });
  const hasFilters = Object.values(filters).some(Boolean);

  const records = dashboard?.records || [];
  const users = dashboard?.users || [];

  return (
    <div className="admin-page">
      <Header />
      <main className="admin-dashboard-main">
        <div className="admin-shell">
          <div className="admin-hero">
            <div className="admin-title-block">
              <h1>{t('adminDashboard.title')}</h1>
              <p>{t('adminDashboard.subtitle')}</p>
            </div>
            <div className="admin-meta">
              {dashboard?.actor?.displayName && (
                <span className="admin-chip">{t('adminDashboard.viewer')}：{dashboard.actor.displayName}</span>
              )}
            </div>
          </div>

          {errorMessage && <div className="admin-error-box">{errorMessage}</div>}

          <div className="admin-grid">
            <div className="admin-card">
              <span>{t('adminDashboard.overview.totalRecords')}</span>
              <strong>{dashboard?.overview?.totalRecords ?? 0}</strong>
            </div>
            <div className="admin-card">
              <span>{t('adminDashboard.overview.activeUsers')}</span>
              <strong>{dashboard?.overview?.activeUsers ?? 0}</strong>
            </div>
            <div className="admin-card">
              <span>{t('adminDashboard.overview.statusDistribution')}</span>
              <strong>{dashboard?.overview?.statusCounts?.length ?? 0}</strong>
            </div>
            <div className="admin-card">
              <span>{t('adminDashboard.overview.typeDistribution')}</span>
              <strong>{dashboard?.overview?.activityTypeCounts?.length ?? 0}</strong>
            </div>
          </div>

          <section className="admin-panel">
            <div className="admin-filter-bar">
              <input
                type="text"
                className="admin-filter-input"
                placeholder={t('adminDashboard.filters.keywordPlaceholder')}
                value={filters.keyword}
                onChange={(event) => updateFilter('keyword', event.target.value)}
              />
              <select className="admin-filter-select" value={filters.userId} onChange={(event) => updateFilter('userId', event.target.value)}>
                <option value="">{t('adminDashboard.filters.user')}</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>{user.displayName || user.email || user.userId}</option>
                ))}
              </select>
              <select className="admin-filter-select" value={filters.activityType} onChange={(event) => updateFilter('activityType', event.target.value)}>
                {activityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select className="admin-filter-select" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input className="admin-filter-input" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
              <input className="admin-filter-input" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
              <button className="admin-secondary-button" onClick={clearFilters} disabled={!hasFilters}>{t('adminDashboard.filters.clear')}</button>
              <button className="admin-action-button" onClick={loadDashboard} disabled={loading}>{loading ? t('common.labels.loading') : t('common.buttons.refresh')}</button>
            </div>

            <div className="admin-summary-meta" style={{ marginBottom: 16 }}>
              {(dashboard?.overview?.statusCounts || []).map((item) => (
                <span key={item.status} className="admin-badge">{t(`history.statuses.${item.status}`)}：{item.count}</span>
              ))}
              {(dashboard?.overview?.activityTypeCounts || []).map((item) => (
                <span key={item.activityType} className="admin-badge">{t(`history.activityTypes.${item.activityType}`)}：{item.count}</span>
              ))}
            </div>

            {loading ? (
              <div className="admin-empty">{t('common.labels.loading')}</div>
            ) : records.length === 0 ? (
              <div className="admin-empty">{t('adminDashboard.empty')}</div>
            ) : (
              <div className="admin-summary-list">
                {records.map((record) => (
                  <article key={record.id} className="admin-summary-item">
                    <div className="admin-summary-top">
                      <div>
                        <div className="admin-summary-title">{record.title || '-'}</div>
                        <div className="admin-summary-meta">
                          <span className="admin-badge">{record.userDisplayName || record.userEmail || '-'}</span>
                          <span className="admin-badge">{t(`history.activityTypes.${record.activityType}`)}</span>
                          <span className={`admin-badge ${record.status === 'completed' ? 'success' : record.status === 'failed' ? 'error' : ''}`}>{t(`history.statuses.${record.status}`)}</span>
                          {record.metadata?.originalFilename && <span className="admin-badge">{record.metadata.originalFilename}</span>}
                        </div>
                      </div>
                      <div className="admin-timestamp">{formatDateTime(record.createdAt)}</div>
                    </div>
                    <p className="admin-summary-excerpt">{record.summary || '-'}</p>
                    <div className="admin-summary-footer">
                      <span>{record.fileId || '-'}</span>
                      <button className="admin-link-button" onClick={() => setSelectedRecord(record)}>{t('history.detail.title')}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />

      {selectedRecord && (
        <div className="admin-drawer-mask" onClick={() => setSelectedRecord(null)}>
          <div className="admin-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="admin-drawer-header">
              <h2>{selectedRecord.title || '-'}</h2>
              <button type="button" className="admin-drawer-close" onClick={() => setSelectedRecord(null)}>×</button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-summary-meta">
                <span className="admin-badge">{selectedRecord.userDisplayName || selectedRecord.userEmail || '-'}</span>
                <span className="admin-badge">{t(`history.activityTypes.${selectedRecord.activityType}`)}</span>
                <span className="admin-badge">{t(`history.statuses.${selectedRecord.status}`)}</span>
                <span className="admin-badge">{formatDateTime(selectedRecord.createdAt)}</span>
              </div>
              <div className="admin-drawer-section">
                <h3>{t('history.detail.summary')}</h3>
                <p>{selectedRecord.summary || '-'}</p>
              </div>
              <div className="admin-drawer-section">
                <h3>{t('history.detail.metadata')}</h3>
                <pre className="admin-drawer-text">{JSON.stringify({ fileId: selectedRecord.fileId, detail: selectedRecord.detail, metadata: selectedRecord.metadata }, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}