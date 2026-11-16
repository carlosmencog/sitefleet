import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getSiteDetail } from '../../../lib/data';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null) {
  if (!value) return 'No inventory';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function alertTitle(type: string) {
  return ({ php_outdated: 'Outdated PHP', wordpress_outdated: 'Outdated WordPress', plugin_update_available: 'Plugin update available' } as Record<string, string>)[type] ?? type;
}

export default async function SiteDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  noStore();
  const { agentId } = await params;
  const { site, alerts } = await getSiteDetail(agentId);
  if (!site) notFound();
  const pendingPlugins = site.inventory?.plugins.filter((plugin) => plugin.updateAvailable) ?? [];
  const status = site.critical_count ? 'Critical' : site.alert_count ? 'Needs review' : 'Healthy';
  const tone = site.critical_count ? 'critical' : site.alert_count ? 'warning' : 'healthy';
  const wordpressAdminUrl = `${site.site_url.replace(/\/$/, '')}/wp-admin/`;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span aria-hidden="true">SF</span><div><strong>SiteFleet</strong><small>Fleet operations</small></div></div><nav aria-label="Primary navigation"><Link className="nav-item" href="/" style={{ textDecoration: 'none' }}>Overview</Link><span className="nav-item active">Sites</span><span className="nav-item">Alerts</span><span className="nav-item muted">Integrations coming soon</span></nav><p className="sidebar-note">Every status comes from the latest inventory received. No simulated metrics.</p></aside>
    <div className="content"><div className="detail-shell">
    <Link className="back-link" href="/">← Back to fleet</Link>
    <header className="detail-header"><div><p className="eyebrow">SITE DETAIL</p><h1>{site.site_url.replace(/^https?:\/\//, '')}</h1><p className="lead">Last inventory received {formatDate(site.last_inventory_at)}.</p></div><div><a className="nav-item active" href={wordpressAdminUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Go to WordPress</a><span className={`pill ${tone}`} style={{ marginLeft: '10px' }}>{status}</span></div></header>
    <section className="detail-grid" aria-label="Site technical status"><article className="detail-card"><span>WordPress</span><strong>{site.inventory?.wordpressVersion ?? '—'}</strong></article><article className="detail-card"><span>PHP</span><strong>{site.inventory?.phpVersion ?? '—'}</strong></article><article className="detail-card"><span>Open alerts</span><strong>{site.alert_count}</strong></article><article className="detail-card"><span>Plugin updates</span><strong className={pendingPlugins.length ? 'warning-text' : ''}>{pendingPlugins.length}</strong></article></section>
    <section className="detail-panel"><div className="panel-heading"><div><p className="eyebrow">PLUGINS</p><h2>Pending updates</h2></div><span className="subtle">From the latest inventory</span></div>{pendingPlugins.length ? <div className="plugin-list">{pendingPlugins.map((plugin) => <div className="plugin-row" key={plugin.slug}><div><strong>{plugin.slug}</strong><span>Installed version {plugin.version}</span></div><span className="pill warning">Update available</span></div>)}</div> : <p className="empty">All installed plugins are up to date.</p>}</section>
    <section className="detail-panel"><div className="panel-heading"><div><p className="eyebrow">ALERTS</p><h2>Open findings</h2></div></div>{alerts.length ? <div className="plugin-list">{alerts.map((alert, index) => <div className="plugin-row" key={`${alert.type}-${index}`}><div><strong>{alertTitle(alert.type)}</strong><span>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · Last seen {formatDate(alert.last_seen_at)}</span></div><span className={`pill ${alert.severity}`}>{alert.severity === 'critical' ? 'Critical' : 'Warning'}</span></div>)}</div> : <p className="empty">No open alerts.</p>}</section>
    </div></div></main>;
}
