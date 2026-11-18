export type PerformanceStrategy = 'mobile' | 'desktop';
export type PerformanceScores = { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
export type PerformanceMetrics = { lcpMs: number | null; cls: number | null; inpMs: number | null; fcpMs: number | null; tbtMs: number | null };
export type PerformanceOpportunity = { id: string; title: string; displayValue: string | null; savingsMs: number | null };
export type LighthouseResult = { strategy: PerformanceStrategy; scores: PerformanceScores; metrics: PerformanceMetrics; opportunities: PerformanceOpportunity[] };

type LighthouseAudit = { title?: string; displayValue?: string; numericValue?: number; details?: { type?: string; overallSavingsMs?: number } };
type LighthouseReport = { categories?: Record<string, { score?: number | null }>; audits?: Record<string, LighthouseAudit> };

const score = (value: number | null | undefined) => typeof value === 'number' ? Math.round(value * 100) : null;
const metric = (audits: Record<string, LighthouseAudit>, id: string) => audits[id]?.numericValue ?? null;

export function normalizeLighthouse(report: LighthouseReport, strategy: PerformanceStrategy): LighthouseResult {
  const categories = report.categories ?? {};
  const audits = report.audits ?? {};
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

export async function runLighthouse(targetUrl: string, strategy: PerformanceStrategy): Promise<LighthouseResult> {
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([import('lighthouse'), import('chrome-launcher')]);
  const chromePath = process.env.CHROME_PATH;
  const resolverRules = process.env.LOCAL_LIGHTHOUSE_RESOLVER_RULES;
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', ...(resolverRules ? [`--host-resolver-rules=${resolverRules}`] : [])],
  });
  try {
    const result = await lighthouse(targetUrl, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: strategy,
      screenEmulation: strategy === 'desktop' ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false } : undefined,
    });
    if (!result?.lhr) throw new Error('Lighthouse did not return a report.');
    return normalizeLighthouse(result.lhr as LighthouseReport, strategy);
  } finally {
    await chrome.kill();
  }
}
