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

export type FleetSite = { site_url: string; last_inventory_at: Date | null; alert_count: number; critical_count: number };
export type FleetAlert = { site_url: string; type: string; severity: 'warning' | 'critical'; details: Record<string, string>; last_seen_at: Date };

export async function getFleet() {
  const pool = getPool();
  const [sites, alerts] = await Promise.all([
    pool.query<FleetSite>("SELECT s.site_url, max(e.received_at) AS last_inventory_at, count(al.id)::int AS alert_count, count(al.id) FILTER (WHERE al.severity = 'critical')::int AS critical_count FROM sites s JOIN agents ag ON ag.site_id = s.id LEFT JOIN inventory_events e ON e.agent_id = ag.id LEFT JOIN alerts al ON al.agent_id = ag.id GROUP BY s.id, s.site_url ORDER BY max(e.received_at) DESC NULLS LAST"),
    pool.query<FleetAlert>("SELECT s.site_url, al.type, al.severity, al.details, al.last_seen_at FROM alerts al JOIN agents ag ON ag.id = al.agent_id JOIN sites s ON s.id = ag.site_id ORDER BY CASE al.severity WHEN 'critical' THEN 0 ELSE 1 END, al.last_seen_at DESC LIMIT 50"),
  ]);
  return { sites: sites.rows, alerts: alerts.rows };
}
