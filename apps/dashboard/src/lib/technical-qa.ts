import { lookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

export type QaSeverity = 'warning' | 'critical';
export type QaFinding = { type: 'broken_link' | 'missing_resource' | 'missing_alt' | 'missing_title' | 'missing_meta_description' | 'missing_h1' | 'multiple_h1'; severity: QaSeverity; pageUrl: string; targetUrl?: string; message: string };
export type QaSummary = { pagesChecked: number; linksChecked: number; resourcesChecked: number; criticalCount: number; warningCount: number };
export type TechnicalQaResult = { summary: QaSummary; findings: QaFinding[] };

const maxPages = 15;
const maxResources = 60;

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function findTags(html: string, selector: string) { return html.match(new RegExp(`<${selector}\\b[^>]*>`, 'gi')) ?? []; }
function normalize(raw: string, base: string) {
  try { const url = new URL(raw, base); url.hash = ''; return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}

const localLookup: LookupFunction = (hostname, options, callback) => {
  const lookupOptions = typeof options === 'function' ? undefined : options;
  const done = typeof options === 'function' ? options : callback!;
  const resolvedHost = hostname.endsWith('.local') ? 'host.docker.internal' : hostname;
  return lookupOptions ? lookup(resolvedHost, lookupOptions, done) : lookup(resolvedHost, done);
};

async function fetchPage(rawUrl: string, readBody = true): Promise<{ status: number; text: string; contentType: string }> {
  const url = new URL(rawUrl);
  const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = client(url, { headers: { 'user-agent': 'SiteFleet Technical QA/1.0', accept: 'text/html,*/*;q=0.8' }, lookup: localLookup, timeout: 12_000 }, (response) => {
      const result = { status: response.statusCode ?? 0, text: '', contentType: String(response.headers['content-type'] ?? '') };
      if (!readBody) { response.resume(); resolve(result); return; }
      const chunks: Buffer[] = []; let size = 0; let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve({ ...result, text: Buffer.concat(chunks).toString('utf8') }); } };
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size <= 1_500_000) chunks.push(chunk); else { response.destroy(); finish(); } });
      response.once('end', finish); response.once('close', finish); response.once('error', (error) => { if (!settled) { settled = true; reject(error); } });
    });
    request.once('timeout', () => request.destroy(new Error('Request timed out.')));
    request.once('error', reject); request.end();
  });
}

function findingKey(finding: QaFinding) { return `${finding.type}:${finding.pageUrl}:${finding.targetUrl ?? ''}`; }

export async function runTechnicalQa(targetUrl: string): Promise<TechnicalQaResult> {
  const root = new URL(targetUrl); const queue = [root.toString()]; const visited = new Set<string>(); const resourceTargets = new Set<string>(); const findings: QaFinding[] = [];
  const add = (finding: QaFinding) => { if (!findings.some((item) => findingKey(item) === findingKey(finding))) findings.push(finding); };

  while (queue.length && visited.size < maxPages) {
    const pageUrl = queue.shift()!; if (visited.has(pageUrl)) continue; visited.add(pageUrl);
    let response: Awaited<ReturnType<typeof fetchPage>>;
    try { response = await fetchPage(pageUrl); } catch { add({ type: 'broken_link', severity: 'critical', pageUrl, targetUrl: pageUrl, message: 'The page could not be reached.' }); continue; }
    if (response.status >= 400) { add({ type: 'broken_link', severity: 'critical', pageUrl, targetUrl: pageUrl, message: `The page returned HTTP ${response.status}.` }); continue; }
    if (!response.contentType.includes('text/html')) continue;
    const html = response.text;
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const descriptionTag = findTags(html, 'meta').find((tag) => attribute(tag, 'name')?.toLowerCase() === 'description');
    if (!title) add({ type: 'missing_title', severity: 'warning', pageUrl, message: 'Page is missing a document title.' });
    if (!descriptionTag || !attribute(descriptionTag, 'content')?.trim()) add({ type: 'missing_meta_description', severity: 'warning', pageUrl, message: 'Page is missing a meta description.' });
    const h1Count = findTags(html, 'h1').length;
    if (!h1Count) add({ type: 'missing_h1', severity: 'warning', pageUrl, message: 'Page is missing an H1 heading.' });
    if (h1Count > 1) add({ type: 'multiple_h1', severity: 'warning', pageUrl, message: `Page has ${h1Count} H1 headings.` });
    for (const image of findTags(html, 'img')) if (attribute(image, 'alt') === null) add({ type: 'missing_alt', severity: 'warning', pageUrl, message: 'Image is missing an alt attribute.' });
    for (const link of findTags(html, 'a')) {
      const href = attribute(link, 'href'); const destination = href ? normalize(href, pageUrl) : null;
      if (destination && new URL(destination).origin === root.origin && !destination.includes('/wp-admin')) queue.push(destination);
    }
    for (const tag of [...findTags(html, 'img'), ...findTags(html, 'script'), ...findTags(html, 'link')]) {
      const raw = attribute(tag, 'src') ?? attribute(tag, 'href'); const destination = raw ? normalize(raw, pageUrl) : null;
      if (destination && new URL(destination).origin === root.origin) resourceTargets.add(destination);
    }
  }
  for (const resourceUrl of [...resourceTargets].slice(0, maxResources)) {
    try { const response = await fetchPage(resourceUrl, false); if (response.status >= 400) add({ type: 'missing_resource', severity: 'critical', pageUrl: targetUrl, targetUrl: resourceUrl, message: `Resource returned HTTP ${response.status}.` }); }
    catch { add({ type: 'missing_resource', severity: 'critical', pageUrl: targetUrl, targetUrl: resourceUrl, message: 'Resource could not be reached.' }); }
  }
  const summary = { pagesChecked: visited.size, linksChecked: Math.max(0, visited.size - 1), resourcesChecked: Math.min(resourceTargets.size, maxResources), criticalCount: findings.filter((f) => f.severity === 'critical').length, warningCount: findings.filter((f) => f.severity === 'warning').length };
  return { summary, findings: findings.slice(0, 80) };
}
