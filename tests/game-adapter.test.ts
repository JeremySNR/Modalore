import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createProfile, installRecipe, exportPackage, importPackage, snapshotProfile, restoreSnapshot, generateRuntimeSource, detectGame, launchProfile, readProfile, revertVersion } from '../src/main/game/adapter.js';
import { validateRecipe } from '../src/shared/recipe.js';

const recipe = { schemaVersion: 1 as const, title: 'Brighter battles', description: 'Faster enemies and extra coins', damageMultiplier: 1.2, enemySpeedMultiplier: 1.1, coinMultiplier: 1.5 };
async function tempRoot() { const base = path.resolve('.local'); await fs.mkdir(base, { recursive: true }); return fs.mkdtemp(path.join(base, 'game-test-')); }
test('package crosses clean profiles and rejects tampering and unexpected fields', async () => {
  const root = await tempRoot();
  try {
    await createProfile(root, 'one'); await createProfile(root, 'two');
    const first = await installRecipe(root, 'one', recipe);
    const exported = exportPackage(recipe);
    const imported = importPackage(exported);
    const second = await installRecipe(root, 'two', imported.recipe);
    assert.equal(first.hash, second.hash);
    await installRecipe(root, 'one', { ...recipe, coinMultiplier: 2 });
    await assert.rejects(installRecipe(root, 'one', { ...recipe, coinMultiplier: 100 }));
    await revertVersion(root, 'one', first.hash);
    assert.equal((await readProfile(root, 'one')).hash, first.hash);
    const changed = JSON.parse(exported); changed.recipe.coinMultiplier = 3;
    assert.throws(() => importPackage(JSON.stringify(changed)), /integrity/);
    assert.throws(() => importPackage(JSON.stringify({ ...JSON.parse(exported), files: ['../../x'] })), /fields/);
    assert.throws(() => validateRecipe({ ...recipe, damageMultiplier: NaN }));
    assert.throws(() => validateRecipe({ ...recipe, executable: 'code' }));
    await assert.rejects(installRecipe(root, '../escape', recipe));
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'profiles', 'one', 'current.json'), 'utf8')), { recipeHash: first.hash });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('save checkpoint restores profile data and a failed restore keeps current saves', async () => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, 'one'); await fs.mkdir(path.join(profile, 'saves', 'Worlds')); const save = path.join(profile, 'saves', 'Worlds', 'world.wld');
    await fs.mkdir(path.join(profile, 'saves', 'Mods')); const mod = path.join(profile, 'saves', 'Mods', 'example.tmod');
    await fs.writeFile(save, 'before'); const snap = await snapshotProfile(root, 'one');
    await fs.writeFile(save, 'after'); await fs.writeFile(mod, 'new mod');
    await assert.rejects(restoreSnapshot(root, 'one', 'missing'));
    assert.equal(await fs.readFile(save, 'utf8'), 'after');
    await restoreSnapshot(root, 'one', snap); assert.equal(await fs.readFile(save, 'utf8'), 'before');
    assert.equal(await fs.readFile(mod, 'utf8'), 'new mod');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('source generation only inserts validated numbers and launch requires a real profile', async () => {
  const source = await generateRuntimeSource(path.resolve('runtime/ModaloreRules/ModaloreRules.cs'), recipe);
  assert.match(source, /FinalDamage \*= 1\.2f/); assert.doesNotMatch(source, /__DAMAGE__/);
  await assert.rejects(generateRuntimeSource(path.resolve('runtime/ModaloreRules/ModaloreRules.cs'), { ...recipe, damageMultiplier: '1;evil()' }));
  const root = await tempRoot();
  try { await createProfile(root, 'one'); await assert.rejects(launchProfile(root, 'one', root, path.join(root, 'invalid')), /Invalid build stage/); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
  const found = await detectGame([]); assert.deepEqual(found.locations, []);
});
