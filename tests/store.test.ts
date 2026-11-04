import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProjectStore } from '../src/main/store.js';

test('saved projects survive restart, invalid updates preserve current recipe, revert keeps history', async () => {
  const root = path.resolve('.local', `store-test-${randomUUID()}`);
  try {
    const first = new ProjectStore(root);
    const recipe = { schemaVersion: 1, title: 'My first creation', description: 'Test recipe', damageMultiplier: 1, enemyHealthMultiplier: 1, coinMultiplier: 1 };
    const project = await first.create(recipe);
    const reopened = new ProjectStore(root);
    assert.equal((await reopened.list())[0].id, project.id);
    await assert.rejects(reopened.update(project.id, { ...recipe, damageMultiplier: Infinity }));
    assert.equal((await reopened.read(project.id)).hash, project.hash);
    const updated = await reopened.update(project.id, { ...recipe, coinMultiplier: 2 });
    assert.equal(updated.parentHash, project.hash);
    assert.equal(updated.previousRecipes.length, 1);
    assert.equal((await reopened.revert(project.id)).hash, project.hash);
    await assert.rejects(reopened.revert(project.id), /no earlier/);
    await assert.rejects(reopened.read('../secret'), /Invalid project/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
