export type Inventory = { wordpressVersion: string; phpVersion: string; plugins: Array<{ slug: string; version: string; updateAvailable: boolean }>; themes: Array<{ slug: string; version: string; updateAvailable: boolean }>; collectedAt: string };
export type AlertCandidate = { fingerprint: string; type: string; severity: 'warning' | 'critical'; details: Record<string, unknown> };

function below(version: string, minimum: [number, number]) {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  return major < minimum[0] || (major === minimum[0] && minor < minimum[1]);
}

export function evaluateInventory(inventory: Inventory): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];
  if (below(inventory.phpVersion, [8, 1])) alerts.push({ fingerprint: 'php-version', type: 'php_outdated', severity: 'critical', details: { current: inventory.phpVersion, minimum: '8.1' } });
  if (below(inventory.wordpressVersion, [6, 4])) alerts.push({ fingerprint: 'wordpress-version', type: 'wordpress_outdated', severity: 'warning', details: { current: inventory.wordpressVersion, minimum: '6.4' } });
  for (const plugin of inventory.plugins.filter((item) => item.updateAvailable)) alerts.push({ fingerprint: `plugin-update:${plugin.slug}`, type: 'plugin_update_available', severity: 'warning', details: { plugin: plugin.slug, version: plugin.version } });
  return alerts;
}
