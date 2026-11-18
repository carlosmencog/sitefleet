import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { runPageSpeed } from '../../../../../lib/pagespeed';

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
    const target = await pool.query<{ target_url: string }>('SELECT target_url FROM site_performance_targets WHERE agent_id = $1', [agentId]);
    if (!target.rowCount) return NextResponse.json({ error: 'Save a public performance URL first.' }, { status: 400 });
    const targetUrl = target.rows[0].target_url;
    const results = await Promise.all([runPageSpeed(targetUrl, 'mobile'), runPageSpeed(targetUrl, 'desktop')]);
    for (const result of results) {
      await pool.query(`INSERT INTO performance_audits (agent_id, target_url, strategy, scores, metrics, opportunities)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`, [agentId, targetUrl, result.strategy, JSON.stringify(result.scores), JSON.stringify(result.metrics), JSON.stringify(result.opportunities)]);
    }
    return NextResponse.json({ auditedAt: new Date().toISOString() });
  } catch (error) {
    console.error('PageSpeed audit failed', error);
    return NextResponse.json({ error: 'PageSpeed could not complete this audit. Check the URL or try again.' }, { status: 502 });
  } finally { await pool.end(); }
}
