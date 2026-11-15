import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import { getFleet } from '../lib/data';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null) {
  if (!value) return 'No inventory';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function titleFor(type: string) {
  return ({ php_outdated: 'Outdated PHP', wordpress_outdated: 'Outdated WordPress', plugin_update_available: 'Plugin update available' } as Record<string, string>)[type] ?? type;
}

function healthFor(lastInventoryAt: Date | null, criticalCount: number, alertCount: number) {
  if (!lastInventoryAt) return { label: 'No report', tone: 'stale' };
  const ageHours = (Date.now() - lastInventoryAt.getTime()) / 3_600_000;
  if (ageHours > 26) return { label: 'Report overdue', tone: 'stale' };
  if (criticalCount) return { label: 'Critical attention', tone: 'critical' };
  if (alertCount) return { label: 'Needs review', tone: 'warning' };
  return { label: 'Healthy', tone: 'healthy' };
}

export default async function Dashboard() {
  noStore();
  const { sites, alerts } = await getFleet();
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span aria-hidden="true">SF</span><div><strong>SiteFleet</strong><small>Fleet operations</small></div></div><nav aria-label="Primary navigation"><span className="nav-item active">Overview</span><span className="nav-item">Sites</span><span className="nav-item">Alerts</span><span className="nav-item muted">Integrations coming soon</span></nav><p className="sidebar-note">Every status comes from the latest inventory received. No simulated metrics.</p></aside>
    <div className="content"><header className="topbar"><div><p className="eyebrow">OVERVIEW</p><h1>Your fleet, at a glance.</h1><p className="lead">Prioritize sites that need attention before they become incidents.</p></div><span className="live" role="status" aria-live="polite">Live inventories</span></header>
    <section className="metrics" aria-label="Fleet summary">
      <article><span>Connected sites</span><strong>{sites.length}</strong></article>
      <article><span>Open alerts</span><strong>{alerts.length}</strong></article>
      <article className={critical ? 'critical' : ''}><span>Critical</span><strong>{critical}</strong></article>
    </section>
    <section className="fleet-section" aria-labelledby="fleet-heading"><div className="section-heading"><div><p className="eyebrow">FLEET</p><h2 id="fleet-heading">Site health</h2></div><span className="subtle">Refreshes when each inventory is received</span></div><div className="site-grid">{sites.length ? sites.map((site) => { const health = healthFor(site.last_inventory_at, site.critical_count, site.alert_count); return <Link className="site-card site-card-link" href={`/sites/${site.agent_id}`} key={site.agent_id} aria-label={`View details for ${site.site_url}`}><div className="site-card-head"><div className="site-ident"><span className="site-mark" aria-hidden="true">WP</span><div><h3>{site.site_url.replace(/^https?:\/\//, '')}</h3><p>{formatDate(site.last_inventory_at)}</p></div></div><span className={`pill ${health.tone}`}>{health.label}</span></div><div className="site-stats"><div><span>WordPress</span><strong>{site.inventory?.wordpressVersion ?? '—'}</strong></div><div><span>PHP</span><strong>{site.inventory?.phpVersion ?? '—'}</strong></div><div><span>Plugins</span><strong className={site.update_count ? 'warning-text' : ''}>{site.update_count ? `${site.update_count} pending` : 'Up to date'}</strong></div></div><div className="site-footer"><span>{site.alert_count ? `${site.alert_count} open alerts` : 'No open alerts'}</span><span className={`status-dot ${health.tone}`} aria-hidden="true"/></div></Link>; }) : <p className="empty">No sites connected yet.</p>}</div></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ATTENTION</p><h2>Open alerts</h2></div></div><div className="alerts">{alerts.length ? alerts.map((alert, index) => <article className="alert" key={`${alert.site_url}-${alert.type}-${index}`}><span className={`dot ${alert.severity}`} aria-hidden="true"/><div><h3>{titleFor(alert.type)}</h3><p>{alert.site_url}</p><small>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · {formatDate(alert.last_seen_at)}</small></div><span className={`pill ${alert.severity}`}>{alert.severity === 'critical' ? 'Critical' : 'Warning'}</span></article>) : <p className="empty">No open alerts.</p>}</div></section>
    </div></main>;
}
