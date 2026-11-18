'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './ui-icon';

type Audit = {
  strategy: 'mobile' | 'desktop';
  scores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
  metrics: { lcpMs: number | null; cls: number | null; inpMs: number | null; fcpMs: number | null; tbtMs: number | null };
  opportunities: Array<{ id: string; title: string; displayValue: string | null; savingsMs: number | null }>;
  fetchedAt: string;
};

function scoreTone(score: number | null) {
  if (score === null) return 'unknown';
  if (score >= 90) return 'good';
  if (score >= 50) return 'watch';
  return 'poor';
}

function formatMilliseconds(value: number | null) { return value === null ? '—' : `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`; }
function formatCls(value: number | null) { return value === null ? '—' : value.toFixed(3); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

function AuditCard({ audit }: { audit: Audit }) {
  const scoreItems = [['Performance', audit.scores.performance], ['Accessibility', audit.scores.accessibility], ['Best practices', audit.scores.bestPractices], ['SEO', audit.scores.seo]] as const;
  return <article className="performance-card">
    <div className="performance-card-heading"><div><p className="eyebrow">{audit.strategy.toUpperCase()}</p><h3>{audit.strategy === 'mobile' ? 'Mobile experience' : 'Desktop experience'}</h3></div><span className={`score-pill ${scoreTone(audit.scores.performance)}`}>{audit.scores.performance ?? '—'}</span></div>
    <div className="score-grid" aria-label={`${audit.strategy} audit scores`}>{scoreItems.map(([label, score]) => <div key={label}><span>{label}</span><strong className={scoreTone(score)}>{score ?? '—'}</strong></div>)}</div>
    <dl className="vitals-grid"><div><dt>LCP</dt><dd>{formatMilliseconds(audit.metrics.lcpMs)}</dd></div><div><dt>CLS</dt><dd>{formatCls(audit.metrics.cls)}</dd></div><div><dt>INP</dt><dd>{formatMilliseconds(audit.metrics.inpMs)}</dd></div><div><dt>FCP</dt><dd>{formatMilliseconds(audit.metrics.fcpMs)}</dd></div></dl>
    <p className="audit-timestamp">Audited {formatDate(audit.fetchedAt)}</p>
    {audit.opportunities.length ? <div className="opportunity-list"><p>Top opportunities</p>{audit.opportunities.map((opportunity) => <div key={opportunity.id}><span>{opportunity.title}</span><small>{opportunity.displayValue ?? (opportunity.savingsMs ? `Potential saving ${Math.round(opportunity.savingsMs)} ms` : 'Review opportunity')}</small></div>)}</div> : <p className="audit-empty">No high-impact opportunities reported.</p>}
  </article>;
}

export function PerformancePanel({ agentId, siteUrl, audits }: { agentId: string; siteUrl: string; audits: Audit[] }) {
  const router = useRouter();
  const [auditing, setAuditing] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function runAudit() {
    setAuditing(true); setFeedback(null);
    try {
      const response = await fetch(`/api/sites/${agentId}/performance-audit`, { method: 'POST' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Lighthouse could not complete this audit.');
      setFeedback({ kind: 'success', text: 'Mobile and desktop audits are ready.' }); router.refresh();
    } catch (error) { setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Lighthouse could not complete this audit.' }); }
    finally { setAuditing(false); }
  }

  return <section className="performance-panel" aria-labelledby="performance-heading">
    <div className="section-heading"><div><p className="eyebrow">LOCAL LIGHTHOUSE</p><h2 id="performance-heading">Site performance</h2><p className="performance-copy">Audit this connected local site with the same Lighthouse engine used by Chrome. It never changes WordPress.</p></div><button className="primary-button" type="button" onClick={runAudit} disabled={auditing}>{auditing ? 'Running audit…' : <>Run audit <Icon name="activity" size={16} /></>}</button></div>
    <div className="audit-target"><span>Local target</span><strong>{siteUrl.replace(/^https?:\/\//, '')}</strong></div>
    <div className="audit-feedback" role="status" aria-live="polite">{feedback ? <span className={feedback.kind}>{feedback.text}</span> : <>Audits run only when you press <strong>Run audit</strong>. Mobile and desktop results are stored locally.</>}</div>
    {audits.length ? <div className="performance-audits">{[...audits].sort((a, b) => a.strategy.localeCompare(b.strategy)).map((audit) => <AuditCard key={audit.strategy} audit={audit} />)}</div> : <p className="audit-empty">No audit saved yet. Run the first local audit when you are ready.</p>}
  </section>;
}
