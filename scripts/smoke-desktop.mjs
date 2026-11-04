import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
const data = path.resolve('.local', `desktop-smoke-${Date.now()}`);
await fs.mkdir(data, { recursive: true });
const env = { ...process.env, MODALORE_DATA_DIR: data }; delete env.ELECTRON_RUN_AS_NODE;
const started = performance.now();
const app = await electron.launch({ args: ['.'], env, timeout: 30000 });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.feature');
  const readyMs = Math.round(performance.now() - started);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  assert.equal(await page.evaluate(() => typeof window.modalore?.createProject), 'function');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const recipe = { schemaVersion: 1, title: 'Native smoke test', description: 'Created through the real Electron bridge.', damageMultiplier: 1.2, enemyHealthMultiplier: 1, coinMultiplier: 1.5 };
  const project = await page.evaluate(r => window.modalore.createProject(r), recipe);
  const updated = await page.evaluate(({ id, recipe }) => window.modalore.updateProject(id, { ...recipe, coinMultiplier: 2 }), { id: project.id, recipe });
  assert.equal(updated.recipe.coinMultiplier, 2);
  const snapshot = await page.evaluate(() => window.modalore.snapshot());
  assert.equal(snapshot.projects.length, 1);
  await page.reload(); await page.waitForSelector('.feature');
  const nav = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await page.getByRole('button', { name: 'My library', exact: true }).click();
    await page.getByRole('heading', { name: 'Native smoke test' }).waitFor();
    nav.push(Math.round(performance.now() - start));
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
  }
  await fs.mkdir('docs', { recursive: true });
  await page.screenshot({ path: 'docs/desktop-native.png', fullPage: true });
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics().map(m => ({ type: m.type, workingSetKB: m.memory.workingSetSize, cpu: m.cpu.percentCPUUsage })));
  const report = { checkedAt: new Date().toISOString(), platform: process.platform, readyMs, navigationAutomationRoundtripMs: nav, processes: metrics, rendererErrors: errors, checks: ['real Electron preload', 'no renderer require', 'create project', 'update project', 'persisted snapshot', 'library navigation'], disclaimer: 'One local development launch, not a controlled cold-start benchmark. Navigation includes automation overhead.' };
  await fs.writeFile('docs/performance-local.json', JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally { await app.close(); }
