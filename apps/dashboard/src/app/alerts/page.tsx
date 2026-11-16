import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { Sidebar } from '../components/sidebar';
import { getFleet } from '../../lib/data';
import { Icon } from '../components/ui-icon';

export const dynamic = 'force-dynamic';

function formatDate(value: Date) { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value); }
function titleFor(type: string) { return ({ php_outdated: 'Outdated PHP', wordpress_outdated: 'Outdated WordPress', plugin_update_available: 'Plugin update available' } as Record<string, string>)[type] ?? type; }

export default async function AlertsPage() {
  noStore();
  const { alerts } = await getFleet();
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  return <main className="app-shell"><Sidebar active="alerts" /><div className="workspace">
    <header className="page-header"><div><p className="eyebrow">FLEET ATTENTION</p><h1>Open findings.</h1><p className="lead">Every current alert across your connected sites, ordered by severity and last activity.</p></div><span className="sync-state">{critical ? `${critical} critical` : 'No critical findings'}</span></header>
    <section className="findings global-findings" aria-labelledby="alerts-heading"><div className="section-heading"><div><p className="eyebrow">ALL ALERTS</p><h2 id="alerts-heading">{alerts.length} open findings</h2></div><span className="subtle">From the latest inventories</span></div><div className="findings-list">{alerts.length ? alerts.map((alert, index) => <article className="finding" key={`${alert.agent_id}-${alert.type}-${index}`}><span className={`finding-marker ${alert.severity}`} aria-hidden="true"><Icon name="alert" size={15} /></span><div className="finding-copy"><h3>{titleFor(alert.type)}</h3><Link className="finding-site" href={`/sites/${alert.agent_id}`}>{alert.site_url.replace(/^https?:\/\//, '')}</Link><small>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · Last seen {formatDate(alert.last_seen_at)}</small></div><span className={`health-badge ${alert.severity}`}>{alert.severity}</span></article>) : <p className="empty">No open findings. Your fleet is clear.</p>}</div></section>
  </div></main>;
}
