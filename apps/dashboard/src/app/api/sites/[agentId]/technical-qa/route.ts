import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { runTechnicalQa } from '../../../../../lib/technical-qa';

export const runtime = 'nodejs';
function getPool() { const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw new Error('DATABASE_URL is required'); return new Pool({ connectionString: databaseUrl }); }

export async function POST(_request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params; const pool = getPool();
  try {
    const target = await pool.query<{ site_url: string }>('SELECT s.site_url FROM agents ag JOIN sites s ON s.id = ag.site_id WHERE ag.id = $1', [agentId]);
    if (!target.rowCount) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
    const result = await runTechnicalQa(target.rows[0].site_url);
    await pool.query('INSERT INTO technical_qa_audits (agent_id, target_url, summary, findings) VALUES ($1, $2, $3::jsonb, $4::jsonb)', [agentId, target.rows[0].site_url, JSON.stringify(result.summary), JSON.stringify(result.findings)]);
    return NextResponse.json({ auditedAt: new Date().toISOString(), summary: result.summary });
  } catch (error) { console.error('Technical QA failed', error); return NextResponse.json({ error: 'Technical QA could not complete. Confirm that the local site is running and try again.' }, { status: 502 }); }
  finally { await pool.end(); }
}
