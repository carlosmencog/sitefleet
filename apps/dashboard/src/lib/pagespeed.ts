export type PerformanceStrategy = 'mobile' | 'desktop';
export type PerformanceScores = { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
export type PerformanceMetrics = { lcpMs: number | null; cls: number | null; inpMs: number | null; fcpMs: number | null; tbtMs: number | null };
export type PerformanceOpportunity = { id: string; title: string; displayValue: string | null; savingsMs: number | null };
export type PageSpeedResult = { strategy: PerformanceStrategy; scores: PerformanceScores; metrics: PerformanceMetrics; opportunities: PerformanceOpportunity[] };

type LighthouseAudit = { title?: string; displayValue?: string; numericValue?: number; score?: number | null; details?: { type?: string; overallSavingsMs?: number } };
type PageSpeedResponse = { lighthouseResult?: { categories?: Record<string, { score?: number | null }>; audits?: Record<string, LighthouseAudit> } };

const score = (value: number | null | undefined) => typeof value === 'number' ? Math.round(value * 100) : null;
const metric = (audits: Record<string, LighthouseAudit>, id: string) => audits[id]?.numericValue ?? null;

export function normalizePageSpeed(response: PageSpeedResponse, strategy: PerformanceStrategy): PageSpeedResult {
  const categories = response.lighthouseResult?.categories ?? {};
  const audits = response.lighthouseResult?.audits ?? {};
  const opportunities = Object.entries(audits)
    .filter(([, audit]) => audit.details?.type === 'opportunity' && (audit.details.overallSavingsMs ?? 0) > 0)
    .map(([id, audit]) => ({ id, title: audit.title ?? id, displayValue: audit.displayValue ?? null, savingsMs: audit.details?.overallSavingsMs ?? null }))
    .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
    .slice(0, 4);
  return {
    strategy,
    scores: { performance: score(categories.performance?.score), accessibility: score(categories.accessibility?.score), bestPractices: score(categories['best-practices']?.score), seo: score(categories.seo?.score) },
    metrics: { lcpMs: metric(audits, 'largest-contentful-paint'), cls: metric(audits, 'cumulative-layout-shift'), inpMs: metric(audits, 'interaction-to-next-paint'), fcpMs: metric(audits, 'first-contentful-paint'), tbtMs: metric(audits, 'total-blocking-time') },
    opportunities,
  };
}

export async function runPageSpeed(targetUrl: string, strategy: PerformanceStrategy): Promise<PageSpeedResult> {
  const query = new URLSearchParams({ url: targetUrl, strategy });
  for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) query.append('category', category);
  if (process.env.PAGESPEED_API_KEY) query.set('key', process.env.PAGESPEED_API_KEY);
  const response = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${query.toString()}`, { signal: AbortSignal.timeout(90_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`PageSpeed returned HTTP ${response.status}`);
  return normalizePageSpeed(await response.json() as PageSpeedResponse, strategy);
}
