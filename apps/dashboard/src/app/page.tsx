import { unstable_noStore as noStore } from 'next/cache';
import { getFleet } from '../lib/data';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null) {
  if (!value) return 'Sin inventario';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function titleFor(type: string) {
  return ({ php_outdated: 'PHP desactualizado', wordpress_outdated: 'WordPress desactualizado', plugin_update_available: 'Actualización de plugin' } as Record<string, string>)[type] ?? type;
}

export default async function Dashboard() {
  noStore();
  const { sites, alerts } = await getFleet();
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  return <main className="shell">
    <header className="topbar"><div><p className="eyebrow">OPERACIONES</p><h1>SiteFleet</h1></div><span className="live" role="status" aria-live="polite">Datos en tiempo real</span></header>
    <section className="metrics" aria-label="Resumen de flota">
      <article><span>Sitios conectados</span><strong>{sites.length}</strong></article>
      <article><span>Alertas abiertas</span><strong>{alerts.length}</strong></article>
      <article className={critical ? 'critical' : ''}><span>Críticas</span><strong>{critical}</strong></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">FLOTA</p><h2>Estado de sitios</h2></div><span className="subtle">Actualiza al recargar</span></div>
      <div className="table-wrap"><table><thead><tr><th>Sitio</th><th>Último inventario</th><th>Alertas</th><th>Estado</th></tr></thead><tbody>{sites.length ? sites.map((site) => <tr key={site.site_url}><td className="site">{site.site_url}</td><td>{formatDate(site.last_inventory_at)}</td><td>{site.alert_count}</td><td><span className={`pill ${site.critical_count ? 'critical' : site.alert_count ? 'warning' : 'healthy'}`}>{site.critical_count ? 'Crítico' : site.alert_count ? 'Revisar' : 'Saludable'}</span></td></tr>) : <tr><td colSpan={4}>Aún no hay sitios conectados.</td></tr>}</tbody></table></div>
    </section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ATENCIÓN</p><h2>Alertas abiertas</h2></div></div><div className="alerts">{alerts.length ? alerts.map((alert, index) => <article className="alert" key={`${alert.site_url}-${alert.type}-${index}`}><span className={`dot ${alert.severity}`} aria-hidden="true"/><div><h3>{titleFor(alert.type)}</h3><p>{alert.site_url}</p><small>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · {formatDate(alert.last_seen_at)}</small></div><span className={`pill ${alert.severity}`}>{alert.severity === 'critical' ? 'Crítica' : 'Advertencia'}</span></article>) : <p className="empty">Sin alertas abiertas.</p>}</div></section>
  </main>;
}
