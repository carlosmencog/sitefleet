import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { runLighthouse } from '../../../../../lib/lighthouse';

export const runtime = 'nodejs';

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return new Pool({ connectionString: databaseUrl });
}

export async function POST(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const pool = getPool();
  try {
    const target = await pool.query<{ site_url: string }>('SELECT s.site_url FROM agents ag JOIN sites s ON s.id = ag.site_id WHERE ag.id = $1', [agentId]);
    if (!target.rowCount) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
    const targetUrl = target.rows[0].site_url;
    // Lighthouse keeps process-level performance marks, so its mobile and desktop runs must not overlap.
    const results = [await runLighthouse(targetUrl, 'mobile'), await runLighthouse(targetUrl, 'desktop')];
    for (const result of results) {
      await pool.query(`INSERT INTO performance_audits (agent_id, target_url, strategy, scores, metrics, opportunities)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`, [agentId, targetUrl, result.strategy, JSON.stringify(result.scores), JSON.stringify(result.metrics), JSON.stringify(result.opportunities)]);
    }
    return NextResponse.json({ auditedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Lighthouse audit failed', error);
    return NextResponse.json({ error: 'Lighthouse could not complete this local audit. Confirm that the local site is running and try again.' }, { status: 502 });
  } finally { await pool.end(); }
}
