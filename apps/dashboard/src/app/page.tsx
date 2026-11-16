import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import { getFleet } from '../lib/data';
import { Icon } from './components/ui-icon';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null) {
  if (!value) return 'No inventory received';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function titleFor(type: string) {
  return ({ php_outdated: 'Outdated PHP', wordpress_outdated: 'Outdated WordPress', plugin_update_available: 'Plugin update available' } as Record<string, string>)[type] ?? type;
}

function healthFor(lastInventoryAt: Date | null, criticalCount: number, alertCount: number) {
  if (!lastInventoryAt) return { label: 'No report', tone: 'stale' };
  const ageHours = (Date.now() - lastInventoryAt.getTime()) / 3_600_000;
  if (ageHours > 26) return { label: 'Report overdue', tone: 'stale' };
  if (criticalCount) return { label: 'Critical', tone: 'critical' };
  if (alertCount) return { label: 'Needs review', tone: 'warning' };
  return { label: 'Healthy', tone: 'healthy' };
}

export default async function Dashboard() {
  noStore();
  const { sites, alerts } = await getFleet();
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  const healthy = sites.filter((site) => healthFor(site.last_inventory_at, site.critical_count, site.alert_count).tone === 'healthy').length;

  return <main className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="SiteFleet overview"><span className="brand-mark" aria-hidden="true"><Icon name="pulse" size={19} /></span><strong>SiteFleet</strong></Link>
      <nav className="sidebar-nav" aria-label="Primary navigation"><Link className="nav-item active" href="/"><Icon name="grid" />Overview</Link><span className="nav-item is-disabled"><Icon name="globe" />Sites</span><span className="nav-item is-disabled"><Icon name="alert" />Alerts</span></nav>
      <div className="sidebar-footer"><span className="status-indicator" aria-hidden="true" />Fleet is reporting</div>
    </aside>
    <div className="workspace">
      <header className="page-header">
        <div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Command your WordPress fleet.</h1><p className="lead">Live signals, clear priorities, and a single place to keep every site in view.</p></div>
        <div className="sync-state" role="status" aria-live="polite"><span className="status-indicator" aria-hidden="true" />Live inventory feed</div>
      </header>

      <section className="metrics" aria-label="Fleet summary">
        <article className="metric-card primary"><span className="metric-icon"><Icon name="globe" /></span><div><span>Connected sites</span><strong>{sites.length}</strong><small>Reporting to this workspace</small></div></article>
        <article className="metric-card secondary"><span className="metric-icon"><Icon name="layers" /></span><div><span>Open findings</span><strong>{alerts.length}</strong><small>From the latest inventory</small></div></article>
        <article className={`metric-card accent ${critical ? 'is-critical' : ''}`}><span className="metric-icon"><Icon name={critical ? 'alert' : 'shield'} /></span><div><span>{critical ? 'Critical' : 'Healthy sites'}</span><strong>{critical || healthy}</strong><small>{critical ? 'Prioritize these first' : 'Nothing critical reported'}</small></div></article>
      </section>

      <section className="fleet-section" aria-labelledby="fleet-heading">
        <div className="section-heading"><div><p className="eyebrow">FLEET</p><h2 id="fleet-heading">Sites</h2></div><span className="subtle">Select a site to review its current inventory</span></div>
        <div className="site-grid">{sites.length ? sites.map((site) => {
          const health = healthFor(site.last_inventory_at, site.critical_count, site.alert_count);
          return <Link className="site-card" href={`/sites/${site.agent_id}`} key={site.agent_id} aria-label={`Open ${site.site_url}`}>
            <div className="site-card-top"><div className="site-title"><span className="site-icon"><Icon name="wordpress" /></span><div><p className="site-domain">{site.site_url.replace(/^https?:\/\//, '')}</p><p className="site-meta">Inventory: {formatDate(site.last_inventory_at)}</p></div></div><span className={`health-badge ${health.tone}`}>{health.label}</span></div>
            <dl className="site-stats"><div><dt>WordPress</dt><dd>{site.inventory?.wordpressVersion ?? '—'}</dd></div><div><dt>PHP</dt><dd>{site.inventory?.phpVersion ?? '—'}</dd></div><div><dt>Plugin updates</dt><dd className={site.update_count ? 'warning-text' : ''}>{site.update_count || 'None'}</dd></div></dl>
            <div className="site-card-footer"><span>{site.alert_count ? `${site.alert_count} open finding${site.alert_count === 1 ? '' : 's'}` : 'No open findings'}</span><span className="card-action">View site <Icon name="arrow" size={15} /></span></div>
          </Link>;
        }) : <p className="empty">No sites connected yet.</p>}</div>
      </section>

      <section className="findings" aria-labelledby="findings-heading"><div className="section-heading"><div><p className="eyebrow">ATTENTION</p><h2 id="findings-heading">Open findings</h2></div><span className="subtle">Always based on the most recent inventory</span></div>
        <div className="findings-list">{alerts.length ? alerts.map((alert, index) => <article className="finding" key={`${alert.site_url}-${alert.type}-${index}`}><span className={`finding-marker ${alert.severity}`} aria-hidden="true"><Icon name="alert" size={15} /></span><div className="finding-copy"><h3>{titleFor(alert.type)}</h3><p>{alert.site_url.replace(/^https?:\/\//, '')}</p><small>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · Last seen {formatDate(alert.last_seen_at)}</small></div><span className={`health-badge ${alert.severity}`}>{alert.severity}</span></article>) : <p className="empty">No open findings. Your fleet is clear.</p>}</div>
      </section>
    </div>
  </main>;
}
