import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { sitefleetPool?: Pool };
function getPool() {
  if (globalForDb.sitefleetPool) return globalForDb.sitefleetPool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the dashboard');
  const pool = new Pool({ connectionString: databaseUrl });
  if (process.env.NODE_ENV !== 'production') globalForDb.sitefleetPool = pool;
  return pool;
}

export type InventoryPayload = { wordpressVersion: string; phpVersion: string; plugins: Array<{ slug: string; version: string; updateAvailable: boolean }> };
export type FleetSite = { agent_id: string; site_url: string; last_inventory_at: Date | null; inventory: InventoryPayload | null; alert_count: number; critical_count: number; update_count: number };
export type FleetAlert = { agent_id: string; site_url: string; type: string; severity: 'warning' | 'critical'; details: Record<string, string>; last_seen_at: Date };
export type PerformanceAudit = { strategy: 'mobile' | 'desktop'; target_url: string; scores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null }; metrics: { lcpMs: number | null; cls: number | null; inpMs: number | null; fcpMs: number | null; tbtMs: number | null }; opportunities: Array<{ id: string; title: string; displayValue: string | null; savingsMs: number | null }>; fetched_at: Date };

export async function getFleet() {
  const pool = getPool();
  const [sites, alerts] = await Promise.all([
    pool.query<FleetSite>("SELECT ag.id AS agent_id, s.site_url, latest.received_at AS last_inventory_at, latest.payload AS inventory, COALESCE(alert_summary.alert_count, 0)::int AS alert_count, COALESCE(alert_summary.critical_count, 0)::int AS critical_count, COALESCE(alert_summary.update_count, 0)::int AS update_count FROM sites s JOIN agents ag ON ag.site_id = s.id LEFT JOIN LATERAL (SELECT received_at, payload FROM inventory_events WHERE agent_id = ag.id ORDER BY received_at DESC LIMIT 1) latest ON true LEFT JOIN LATERAL (SELECT count(*) AS alert_count, count(*) FILTER (WHERE severity = 'critical') AS critical_count, count(*) FILTER (WHERE type = 'plugin_update_available') AS update_count FROM alerts WHERE agent_id = ag.id) alert_summary ON true ORDER BY latest.received_at DESC NULLS LAST"),
    pool.query<FleetAlert>("SELECT ag.id AS agent_id, s.site_url, al.type, al.severity, al.details, al.last_seen_at FROM alerts al JOIN agents ag ON ag.id = al.agent_id JOIN sites s ON s.id = ag.site_id ORDER BY CASE al.severity WHEN 'critical' THEN 0 ELSE 1 END, al.last_seen_at DESC LIMIT 50"),
  ]);
  return { sites: sites.rows, alerts: alerts.rows };
}

export async function getSiteDetail(agentId: string) {
  const pool = getPool();
  const [site, alerts] = await Promise.all([
    pool.query<FleetSite>("SELECT ag.id AS agent_id, s.site_url, latest.received_at AS last_inventory_at, latest.payload AS inventory, COALESCE(alert_summary.alert_count, 0)::int AS alert_count, COALESCE(alert_summary.critical_count, 0)::int AS critical_count, COALESCE(alert_summary.update_count, 0)::int AS update_count FROM sites s JOIN agents ag ON ag.site_id = s.id LEFT JOIN LATERAL (SELECT received_at, payload FROM inventory_events WHERE agent_id = ag.id ORDER BY received_at DESC LIMIT 1) latest ON true LEFT JOIN LATERAL (SELECT count(*) AS alert_count, count(*) FILTER (WHERE severity = 'critical') AS critical_count, count(*) FILTER (WHERE type = 'plugin_update_available') AS update_count FROM alerts WHERE agent_id = ag.id) alert_summary ON true WHERE ag.id = $1", [agentId]),
    pool.query<FleetAlert>("SELECT ag.id AS agent_id, s.site_url, al.type, al.severity, al.details, al.last_seen_at FROM alerts al JOIN agents ag ON ag.id = al.agent_id JOIN sites s ON s.id = ag.site_id WHERE ag.id = $1 ORDER BY CASE al.severity WHEN 'critical' THEN 0 ELSE 1 END, al.last_seen_at DESC", [agentId]),
  ]);
  return { site: site.rows[0], alerts: alerts.rows };
}

export async function getPerformanceData(agentId: string) {
  const pool = getPool();
  const audits = await pool.query<PerformanceAudit>(`SELECT DISTINCT ON (strategy) strategy, target_url, scores, metrics, opportunities, fetched_at
      FROM performance_audits WHERE agent_id = $1 ORDER BY strategy, fetched_at DESC`, [agentId]);
  return { audits: audits.rows };
}
