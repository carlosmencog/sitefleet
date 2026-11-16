import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { Sidebar } from '../components/sidebar';
import { getFleet } from '../../lib/data';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null) {
  if (!value) return 'No inventory received';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function healthFor(lastInventoryAt: Date | null, criticalCount: number, alertCount: number) {
  if (!lastInventoryAt) return { label: 'No report', tone: 'stale' };
  const ageHours = (Date.now() - lastInventoryAt.getTime()) / 3_600_000;
  if (ageHours > 26) return { label: 'Report overdue', tone: 'stale' };
  if (criticalCount) return { label: 'Critical', tone: 'critical' };
  if (alertCount) return { label: 'Needs review', tone: 'warning' };
  return { label: 'Healthy', tone: 'healthy' };
}

export default async function SitesPage() {
  noStore();
  const { sites } = await getFleet();
  return <main className="app-shell"><Sidebar active="sites" /><div className="workspace">
    <header className="page-header"><div><p className="eyebrow">FLEET DIRECTORY</p><h1>All connected sites.</h1><p className="lead">A concise operational index of the sites reporting to this workspace.</p></div><span className="sync-state">{sites.length} sites connected</span></header>
    <section className="table-panel" aria-labelledby="sites-table-heading"><div className="table-heading"><div><p className="eyebrow">SITES</p><h2 id="sites-table-heading">Site inventory</h2></div><span className="subtle">Latest received state</span></div><div className="table-scroll"><table><thead><tr><th scope="col">Site</th><th scope="col">Status</th><th scope="col">WordPress</th><th scope="col">PHP</th><th scope="col">Updates</th><th scope="col">Last inventory</th><th scope="col"><span className="sr-only">Open site</span></th></tr></thead><tbody>{sites.map((site) => { const health = healthFor(site.last_inventory_at, site.critical_count, site.alert_count); return <tr key={site.agent_id}><td><Link className="table-site-link" href={`/sites/${site.agent_id}`}>{site.site_url.replace(/^https?:\/\//, '')}</Link><span className="table-subtext">{site.alert_count ? `${site.alert_count} open findings` : 'No open findings'}</span></td><td><span className={`health-badge ${health.tone}`}>{health.label}</span></td><td>{site.inventory?.wordpressVersion ?? '—'}</td><td>{site.inventory?.phpVersion ?? '—'}</td><td className={site.update_count ? 'warning-text' : ''}>{site.update_count || 'None'}</td><td className="table-muted">{formatDate(site.last_inventory_at)}</td><td><Link className="table-open" href={`/sites/${site.agent_id}`}>Open</Link></td></tr>; })}</tbody></table></div></section>
  </div></main>;
}
