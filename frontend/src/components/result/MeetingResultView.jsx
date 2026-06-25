/**
 * MeetingResultView - 结果聚焦视图
 *
 * 展示中英双语会议纪要：摘要 / 关键讨论 / 决策 / 行动项 / 风险 / 下一步
 * 操作集中：复制、下载、发送邮件、重新生成、返回
 */

import React, { useMemo, useState } from 'react';
import { Copy, Check, Download, Mail, RefreshCw, ArrowLeft, Home } from 'lucide-react';
import { useTranslation } from '../../i18n/index.js';
import './MeetingResultView.css';

const formatMinutesText = (data) => {
  if (!data) return '';
  let text = '';
  text += `1. Title / Date / Attendees\n`;
  text += `${data.title || ''}\n`;
  text += `${data.date || ''}\n`;
  if (data.attendees && data.attendees.length > 0) {
    text += `Attendees: ${data.attendees.join(', ')}\n`;
  }
  text += `\n2. Summary\n${data.summary || ''}\n`;

  text += `\n3. Key Discussion Points\n`;
  (data.key_discussion_points || []).forEach((point, idx) => {
    if (typeof point === 'object' && point.topic) {
      text += `${idx + 1}. ${point.topic}\n   ${point.detail || ''}\n`;
    } else {
      text += `- ${point}\n`;
    }
  });

  text += `\n4. Decisions Made\n`;
  (data.decisions_made || []).forEach((d) => { text += `- ${d}\n`; });

  text += `\n5. Action Items\n`;
  (data.action_items || []).forEach((item) => {
    text += `- [${item.assignee || 'Unassigned'}] ${item.task || ''} (Due: ${item.deadline || 'No date'})\n`;
  });

  text += `\n6. Risks / Issues\n`;
  (data.risks_issues || []).forEach((r) => { text += `- ${r}\n`; });

  text += `\n7. Next Steps\n`;
  (data.next_steps || []).forEach((n) => { text += `- ${n}\n`; });

  return text;
};

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`mr-section ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="mr-section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="mr-section-toggle-icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mr-section-body">{children}</div>}
    </section>
  );
};

const MinutesColumn = ({ data, langKey }) => {
  const { t } = useTranslation();
  if (!data) return null;
  return (
    <div className="mr-column">
      <Section title={t('result.sections.summary')}>
        {data.title && <h3 className="mr-meeting-title">{data.title}</h3>}
        {data.date && <div className="mr-meta">{data.date}</div>}
        {data.attendees?.length > 0 && (
          <div className="mr-meta">{t('result.fields.attendees')}: {data.attendees.join(', ')}</div>
        )}
        <p className="mr-summary-text">{data.summary || '-'}</p>
      </Section>

      {data.key_discussion_points?.length > 0 && (
        <Section title={t('result.sections.keyPoints')}>
          <ol className="mr-list">
            {data.key_discussion_points.map((p, idx) => (
              <li key={`${langKey}-pt-${idx}`}>
                {typeof p === 'object' && p.topic ? (
                  <>
                    <strong>{p.topic}</strong>
                    {p.detail && <div>{p.detail}</div>}
                  </>
                ) : <span>{p}</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {data.decisions_made?.length > 0 && (
        <Section title={t('result.sections.decisions')}>
          <ul className="mr-list">{data.decisions_made.map((d, i) => <li key={`${langKey}-d-${i}`}>{d}</li>)}</ul>
        </Section>
      )}

      {data.action_items?.length > 0 && (
        <Section title={t('result.sections.actions')}>
          <ul className="mr-list">
            {data.action_items.map((item, i) => (
              <li key={`${langKey}-a-${i}`}>
                <strong>[{item.assignee || t('result.fields.unassigned')}]</strong> {item.task}
                {item.deadline && <em className="mr-due"> ({t('result.fields.due')}: {item.deadline})</em>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.risks_issues?.length > 0 && (
        <Section title={t('result.sections.risks')}>
          <ul className="mr-list">{data.risks_issues.map((r, i) => <li key={`${langKey}-r-${i}`}>{r}</li>)}</ul>
        </Section>
      )}

      {data.next_steps?.length > 0 && (
        <Section title={t('result.sections.nextSteps')}>
          <ul className="mr-list">{data.next_steps.map((n, i) => <li key={`${langKey}-n-${i}`}>{n}</li>)}</ul>
        </Section>
      )}
    </div>
  );
};

const MeetingResultView = ({
  minutesData,
  transcript,
  onBack,
  onGoHistory,
  onRegenerate,
  onSendEmail,
  onDownload,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('zh');
  const [copied, setCopied] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const zhData = minutesData?.zh || minutesData?.chinese || null;
  const enData = minutesData?.en || minutesData?.english || null;

  const activeData = activeTab === 'zh' ? zhData : enData;
  const fullText = useMemo(() => formatMinutesText(activeData), [activeData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleCopyTranscript = async (e) => {
    e?.stopPropagation?.();
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setTranscriptCopied(true);
      setTimeout(() => setTranscriptCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const tabs = [
    { key: 'zh', label: t('result.tabs.chinese'), disabled: !zhData },
    { key: 'en', label: t('result.tabs.english'), disabled: !enData },
  ];

  return (
    <div className="mr-root">
      <div className="mr-toolbar" role="toolbar" aria-label={t('result.toolbarLabel')}>
        <div className="mr-toolbar-left">
          {onBack && (
            <button type="button" className="mr-btn mr-btn-ghost" onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" />
              {t('result.actions.back')}
            </button>
          )}
          {onGoHistory && (
            <button type="button" className="mr-btn mr-btn-ghost" onClick={onGoHistory}>
              <Home size={14} aria-hidden="true" />
              {t('result.actions.history')}
            </button>
          )}
        </div>
        <div className="mr-toolbar-right">
          <button type="button" className="mr-btn" onClick={handleCopy} aria-label={t('result.actions.copy')}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? t('result.actions.copied') : t('result.actions.copy')}
          </button>
          {onDownload && (
            <button type="button" className="mr-btn" onClick={onDownload}>
              <Download size={14} aria-hidden="true" />
              {t('result.actions.download')}
            </button>
          )}
          {onSendEmail && (
            <button type="button" className="mr-btn" onClick={onSendEmail}>
              <Mail size={14} aria-hidden="true" />
              {t('result.actions.email')}
            </button>
          )}
          {onRegenerate && (
            <button type="button" className="mr-btn mr-btn-primary" onClick={onRegenerate}>
              <RefreshCw size={14} aria-hidden="true" />
              {t('result.actions.regenerate')}
            </button>
          )}
        </div>
      </div>

      <div className="mr-tabs" role="tablist" aria-label={t('result.tabsLabel')}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            disabled={tab.disabled}
            className={`mr-tab ${activeTab === tab.key ? 'is-active' : ''}`}
            onClick={() => !tab.disabled && setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mr-content">
        {activeData ? (
          <MinutesColumn data={activeData} langKey={activeTab} />
        ) : (
          <div className="mr-empty">{t('result.noContent')}</div>
        )}
      </div>

      {transcript && (
        <section className={`mr-section mr-transcript-section ${transcriptOpen ? 'is-open' : ''}`}>
          <div className="mr-transcript-header">
            <button
              type="button"
              className="mr-section-toggle"
              aria-expanded={transcriptOpen}
              onClick={() => setTranscriptOpen((v) => !v)}
            >
              <span>{t('result.sections.transcript')}</span>
              <span className="mr-section-toggle-icon" aria-hidden="true">{transcriptOpen ? '−' : '+'}</span>
            </button>
            <button
              type="button"
              className="mr-btn mr-btn-sm mr-transcript-copy"
              onClick={handleCopyTranscript}
              aria-label={t('result.actions.copy')}
            >
              {transcriptCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {transcriptCopied ? t('result.actions.copied') : t('result.actions.copy')}
            </button>
          </div>
          {transcriptOpen && (
            <div className="mr-section-body">
              <pre className="mr-transcript">{transcript}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default MeetingResultView;
