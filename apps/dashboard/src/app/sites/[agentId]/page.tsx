import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getPerformanceData, getSiteDetail, getTechnicalQaData } from '../../../lib/data';
import { Icon } from '../../components/ui-icon';
import { Sidebar } from '../../components/sidebar';
import { PerformancePanel } from '../../components/performance-panel';
import { TechnicalQaPanel } from '../../components/technical-qa-panel';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null) {
  if (!value) return 'No inventory received';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function alertTitle(type: string) {
  return ({ php_outdated: 'Outdated PHP', wordpress_outdated: 'Outdated WordPress', plugin_update_available: 'Plugin update available' } as Record<string, string>)[type] ?? type;
}

export default async function SiteDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  noStore();
  const { agentId } = await params;
  const [{ site, alerts }, performance, technicalQa] = await Promise.all([getSiteDetail(agentId), getPerformanceData(agentId), getTechnicalQaData(agentId)]);
  if (!site) notFound();
  const pendingPlugins = site.inventory?.plugins.filter((plugin) => plugin.updateAvailable) ?? [];
  const status = site.critical_count ? 'Critical' : site.alert_count ? 'Needs review' : 'Healthy';
  const tone = site.critical_count ? 'critical' : site.alert_count ? 'warning' : 'healthy';
  const wordpressAdminUrl = `${site.site_url.replace(/\/$/, '')}/wp-admin/`;

  return <main className="app-shell">
    <Sidebar active="sites" />
    <div className="workspace detail-workspace">
      <Link href="/" style={{ alignItems: 'center', color: 'var(--violet)', display: 'inline-flex', fontSize: '14px', fontWeight: 800, gap: '6px', marginBottom: 'var(--space-6)', textDecoration: 'none' }}><Icon name="arrow-left" size={16} />Back to overview</Link>
      <header className="detail-header"><div><p className="eyebrow">SITE INVENTORY</p><h1>{site.site_url.replace(/^https?:\/\//, '')}</h1><p className="lead">Last received {formatDate(site.last_inventory_at)}.</p></div><div className="header-actions"><span className={`health-badge ${tone}`}>{status}</span><a className="primary-button" href={wordpressAdminUrl} target="_blank" rel="noreferrer">Go to WordPress <Icon name="arrow" size={16} /></a></div></header>

      <section className="detail-grid" aria-label="Current site status"><article className="detail-card"><span className="detail-icon"><Icon name="wordpress" /></span><span>WordPress</span><strong>{site.inventory?.wordpressVersion ?? '—'}</strong></article><article className="detail-card"><span className="detail-icon"><Icon name="layers" /></span><span>PHP</span><strong>{site.inventory?.phpVersion ?? '—'}</strong></article><article className="detail-card"><span className="detail-icon"><Icon name="alert" /></span><span>Open findings</span><strong>{site.alert_count}</strong></article><article className="detail-card"><span className="detail-icon"><Icon name="activity" /></span><span>Plugin updates</span><strong className={pendingPlugins.length ? 'warning-text' : ''}>{pendingPlugins.length || 'None'}</strong></article></section>

      <section className="detail-panel" aria-labelledby="plugins-heading"><div className="section-heading"><div><p className="eyebrow">PLUGINS</p><h2 id="plugins-heading">Pending updates</h2></div><span className="subtle">Reported by this site</span></div>{pendingPlugins.length ? <div className="data-list">{pendingPlugins.map((plugin) => <div className="data-row" key={plugin.slug}><div><strong>{plugin.slug}</strong><span>Installed version {plugin.version}</span></div><span className="health-badge warning">Update available</span></div>)}</div> : <p className="empty">All installed plugins are up to date.</p>}</section>
      <PerformancePanel agentId={agentId} siteUrl={site.site_url} audits={performance.audits.map((audit) => ({ strategy: audit.strategy, scores: audit.scores, metrics: audit.metrics, opportunities: audit.opportunities, fetchedAt: audit.fetched_at.toISOString() }))} />
      <TechnicalQaPanel agentId={agentId} audit={technicalQa ? { summary: technicalQa.summary, findings: technicalQa.findings, fetchedAt: technicalQa.fetched_at.toISOString() } : null} />
      <section className="detail-panel" aria-labelledby="alerts-heading"><div className="section-heading"><div><p className="eyebrow">ATTENTION</p><h2 id="alerts-heading">Open findings</h2></div></div>{alerts.length ? <div className="data-list">{alerts.map((alert, index) => <div className="data-row" key={`${alert.type}-${index}`}><div><strong>{alertTitle(alert.type)}</strong><span>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · Last seen {formatDate(alert.last_seen_at)}</span></div><span className={`health-badge ${alert.severity}`}>{alert.severity}</span></div>)}</div> : <p className="empty">No open findings for this site.</p>}</section>
    </div>
  </main>;
}
