import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateInventory } from '../src/alert-rules.js';

test('creates actionable alerts for unsupported platform versions and plugin updates', () => {
  const alerts = evaluateInventory({
    wordpressVersion: '6.3.2', phpVersion: '8.0.30',
    plugins: [{ slug: 'seo-plugin/seo.php', version: '1.2.0', updateAvailable: true }], themes: [], collectedAt: '2026-11-15T12:00:00.000Z',
  });
  assert.deepEqual(alerts.map((alert) => alert.type), ['php_outdated', 'wordpress_outdated', 'plugin_update_available']);
  assert.equal(alerts[0]?.severity, 'critical');
});

test('does not create alerts for a current clean inventory', () => {
  assert.deepEqual(evaluateInventory({ wordpressVersion: '6.8.1', phpVersion: '8.3.4', plugins: [], themes: [], collectedAt: '2026-11-15T12:00:00.000Z' }), []);
});
