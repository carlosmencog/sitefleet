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

function healthFor(lastInventoryAt: Date | null, criticalCount: number, alertCount: number) {
  if (!lastInventoryAt) return { label: 'Sin reporte', tone: 'stale' };
  const ageHours = (Date.now() - lastInventoryAt.getTime()) / 3_600_000;
  if (ageHours > 26) return { label: 'Reporte vencido', tone: 'stale' };
  if (criticalCount) return { label: 'Atención crítica', tone: 'critical' };
  if (alertCount) return { label: 'Requiere revisión', tone: 'warning' };
  return { label: 'Saludable', tone: 'healthy' };
}

export default async function Dashboard() {
  noStore();
  const { sites, alerts } = await getFleet();
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span aria-hidden="true">SF</span><div><strong>SiteFleet</strong><small>Control de flota</small></div></div><nav aria-label="Navegación principal"><span className="nav-item active">Visión general</span><span className="nav-item">Sitios</span><span className="nav-item">Alertas</span><span className="nav-item muted">Integraciones próximamente</span></nav><p className="sidebar-note">Cada estado procede del último inventario recibido; no hay métricas simuladas.</p></aside>
    <div className="content"><header className="topbar"><div><p className="eyebrow">VISIÓN GENERAL</p><h1>Tu flota, de un vistazo.</h1><p className="lead">Prioriza sitios que necesitan atención antes de que se conviertan en incidencias.</p></div><span className="live" role="status" aria-live="polite">Inventarios en vivo</span></header>
    <section className="metrics" aria-label="Resumen de flota">
      <article><span>Sitios conectados</span><strong>{sites.length}</strong></article>
      <article><span>Alertas abiertas</span><strong>{alerts.length}</strong></article>
      <article className={critical ? 'critical' : ''}><span>Críticas</span><strong>{critical}</strong></article>
    </section>
    <section className="fleet-section" aria-labelledby="fleet-heading"><div className="section-heading"><div><p className="eyebrow">FLOTA</p><h2 id="fleet-heading">Estado de sitios</h2></div><span className="subtle">Se actualiza al recibir cada inventario</span></div><div className="site-grid">{sites.length ? sites.map((site) => { const health = healthFor(site.last_inventory_at, site.critical_count, site.alert_count); return <article className="site-card" key={site.site_url}><div className="site-card-head"><div className="site-ident"><span className="site-mark" aria-hidden="true">WP</span><div><h3>{site.site_url.replace(/^https?:\/\//, '')}</h3><p>{formatDate(site.last_inventory_at)}</p></div></div><span className={`pill ${health.tone}`}>{health.label}</span></div><div className="site-stats"><div><span>WordPress</span><strong>{site.inventory?.wordpressVersion ?? '—'}</strong></div><div><span>PHP</span><strong>{site.inventory?.phpVersion ?? '—'}</strong></div><div><span>Plugins</span><strong className={site.update_count ? 'warning-text' : ''}>{site.update_count ? `${site.update_count} pendientes` : 'Al día'}</strong></div></div><div className="site-footer"><span>{site.alert_count ? `${site.alert_count} alertas abiertas` : 'Sin alertas abiertas'}</span><span className={`status-dot ${health.tone}`} aria-hidden="true"/></div></article>; }) : <p className="empty">Aún no hay sitios conectados.</p>}</div></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ATENCIÓN</p><h2>Alertas abiertas</h2></div></div><div className="alerts">{alerts.length ? alerts.map((alert, index) => <article className="alert" key={`${alert.site_url}-${alert.type}-${index}`}><span className={`dot ${alert.severity}`} aria-hidden="true"/><div><h3>{titleFor(alert.type)}</h3><p>{alert.site_url}</p><small>{Object.entries(alert.details).map(([key, value]) => `${key}: ${value}`).join(' · ')} · {formatDate(alert.last_seen_at)}</small></div><span className={`pill ${alert.severity}`}>{alert.severity === 'critical' ? 'Crítica' : 'Advertencia'}</span></article>) : <p className="empty">Sin alertas abiertas.</p>}</div></section>
    </div></main>;
}
