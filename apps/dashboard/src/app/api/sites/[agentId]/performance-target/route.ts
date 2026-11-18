import { Pool } from 'pg';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return new Pool({ connectionString: databaseUrl });
}

function validPublicUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const targetUrl = validPublicUrl((await request.json()).targetUrl);
  if (!targetUrl) return NextResponse.json({ error: 'Enter a public HTTP(S) URL.' }, { status: 400 });
  const pool = getPool();
  try {
    const agent = await pool.query('SELECT 1 FROM agents WHERE id = $1', [agentId]);
    if (!agent.rowCount) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
    await pool.query(`INSERT INTO site_performance_targets (agent_id, target_url) VALUES ($1, $2)
      ON CONFLICT (agent_id) DO UPDATE SET target_url = EXCLUDED.target_url, updated_at = now()`, [agentId, targetUrl]);
    return NextResponse.json({ targetUrl });
  } finally { await pool.end(); }
}
