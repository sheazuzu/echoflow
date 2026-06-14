import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../layout/Header.jsx';
import Footer from '../layout/Footer.jsx';
import authService from '../../services/authService.js';
import { useTranslation } from '../../i18n/index.js';
import './UserHistoryPage.css';

const DEFAULT_FILTERS = {
  keyword: '',
  activityType: 'all',
  status: 'all',
  dateFrom: '',
  dateTo: '',
};

const PAGE_SIZE = 12;

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

export default function UserHistoryPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [historyData, setHistoryData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadHistory = useCallback(async (page = 1) => {
    setLoading(true);
    setErrorMessage('');

    const params = {
      ...filters,
      page,
      pageSize: PAGE_SIZE,
    };

    try {
      const [historyResponse, analyticsResponse] = await Promise.all([
        authService.getHistory(params),
        authService.getHistoryAnalytics(filters),
      ]);

      if (!historyResponse?.success) {
        throw new Error(historyResponse?.message || t('history.messages.loadFailed'));
      }

      if (!analyticsResponse?.success) {
        throw new Error(analyticsResponse?.message || t('history.messages.loadFailed'));
      }

      setHistoryData(historyResponse.data?.items || []);
      setPagination(historyResponse.data?.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setAnalytics(analyticsResponse.data?.analytics || null);
    } catch (error) {
      setErrorMessage(error?.message || t('history.messages.loadFailed'));
      setHistoryData([]);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  const activityTypeOptions = useMemo(() => ([
    { value: 'all', label: t('history.filters.allTypes') },
    { value: 'upload_task', label: t('history.activityTypes.upload_task') },
  ]), [t]);

  const statusOptions = useMemo(() => ([
    { value: 'all', label: t('history.filters.allStatuses') },
    { value: 'processing', label: t('history.statuses.processing') },
    { value: 'completed', label: t('history.statuses.completed') },
    { value: 'failed', label: t('history.statuses.failed') },
    { value: 'cancelled', label: t('history.statuses.cancelled') },
  ]), [t]);

  const successCount = useMemo(() => (
    analytics?.statusCounts?.find((item) => item.status === 'completed')?.count || 0
  ), [analytics]);

  const typeCount = analytics?.activityTypeCounts?.length || 0;
  const hasFilters = Object.values(filters).some(Boolean);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="history-page">
      <Header />
      <main className="history-main">
        <div className="history-shell">
          <div className="history-hero">
            <div>
              <h1>{t('history.title')}</h1>
              <p>{t('history.subtitle')}</p>
            </div>
          </div>

          {errorMessage && <div className="history-error">{errorMessage}</div>}

          <section className="history-panel history-overview-panel">
            <div className="history-panel-header">
              <div>
                <h2>{t('history.summaryTitle')}</h2>
              </div>
            </div>
            <div className="history-card-grid">
              <article className="history-stat-card">
                <span>{t('history.analytics.totalRecords')}</span>
                <strong>{analytics?.totalRecords ?? 0}</strong>
              </article>
              <article className="history-stat-card">
                <span>{t('history.analytics.activityTypes')}</span>
                <strong>{typeCount}</strong>
              </article>
              <article className="history-stat-card">
                <span>{t('history.analytics.successRecords')}</span>
                <strong>{successCount}</strong>
              </article>
            </div>
            <div className="history-trend-wrap">
              <div className="history-trend-title">{t('history.analytics.recentDays')}</div>
              <div className="history-trend-list">
                {(analytics?.recentDays || []).map((item) => (
                  <div key={item.date} className="history-trend-item">
                    <span>{item.date}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="history-panel">
            <div className="history-filter-grid">
              <input
                className="history-input"
                value={filters.keyword}
                onChange={(event) => updateFilter('keyword', event.target.value)}
                placeholder={t('history.filters.keywordPlaceholder')}
              />
              <select className="history-select" value={filters.activityType} onChange={(event) => updateFilter('activityType', event.target.value)}>
                {activityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select className="history-select" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input className="history-input" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
              <input className="history-input" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
              <button className="history-secondary-btn" onClick={clearFilters} disabled={!hasFilters}>{t('history.filters.clear')}</button>
            </div>

            {loading ? (
              <div className="history-empty">{t('common.labels.loading')}</div>
            ) : historyData.length === 0 ? (
              <div className="history-empty">
                <strong>{hasFilters ? t('history.noMatchTitle') : t('history.emptyTitle')}</strong>
                <p>{hasFilters ? t('history.noMatchDescription') : t('history.emptyDescription')}</p>
              </div>
            ) : (
              <>
                <div className="history-record-list">
                  {historyData.map((record) => (
                    <article key={record.id} className="history-record-card">
                      <div className="history-record-top">
                        <div>
                          <h3>{record.title || '-'}</h3>
                          <div className="history-record-meta">
                            <span className="history-badge">{t(`history.activityTypes.${record.activityType}`)}</span>
                            <span className={`history-badge status-${record.status}`}>{t(`history.statuses.${record.status}`)}</span>
                            {record.metadata?.originalFilename && <span className="history-badge">{record.metadata.originalFilename}</span>}
                          </div>
                        </div>
                        <div className="history-record-time">{formatDateTime(record.createdAt)}</div>
                      </div>
                      <p className="history-record-summary">{record.summary || '-'}</p>
                      <div className="history-record-footer">
                        <span>{record.fileId || '-'}</span>
                        <button className="history-link-btn" onClick={() => setSelectedRecord(record)}>{t('history.detail.title')}</button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="history-pagination">
                  <button
                    className="history-secondary-btn"
                    disabled={pagination.page <= 1}
                    onClick={() => loadHistory(Math.max(1, pagination.page - 1))}
                  >
                    {t('history.pagination.previous')}
                  </button>
                  <span>{t('history.pagination.pageInfo', { page: pagination.page, totalPages: pagination.totalPages || 1 })}</span>
                  <button
                    className="history-secondary-btn"
                    disabled={pagination.page >= (pagination.totalPages || 1)}
                    onClick={() => loadHistory(Math.min(pagination.totalPages || 1, pagination.page + 1))}
                  >
                    {t('history.pagination.next')}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />

      {selectedRecord && (
        <div className="history-drawer-mask" onClick={() => setSelectedRecord(null)}>
          <div className="history-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="history-drawer-header">
              <h2>{selectedRecord.title || '-'}</h2>
              <button className="history-drawer-close" onClick={() => setSelectedRecord(null)}>{t('history.detail.close')}</button>
            </div>
            <div className="history-drawer-body">
              <div className="history-record-meta">
                <span className="history-badge">{t(`history.activityTypes.${selectedRecord.activityType}`)}</span>
                <span className={`history-badge status-${selectedRecord.status}`}>{t(`history.statuses.${selectedRecord.status}`)}</span>
                <span className="history-badge">{formatDateTime(selectedRecord.createdAt)}</span>
              </div>
              <section>
                <h3>{t('history.detail.summary')}</h3>
                <p>{selectedRecord.summary || '-'}</p>
              </section>
              <section>
                <h3>{t('history.detail.metadata')}</h3>
                <pre>{JSON.stringify({ fileId: selectedRecord.fileId, detail: selectedRecord.detail, metadata: selectedRecord.metadata }, null, 2)}</pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}