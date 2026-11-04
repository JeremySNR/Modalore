import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createProfile,
  installRecipe,
  exportPackage,
  importPackage,
  snapshotProfile,
  restoreSnapshot,
  generateRuntimeSource,
  detectGame,
  launchProfile,
  readProfile,
  revertVersion,
  buildRuntime,
  recoverProfile,
  readLatestCheckpoint,
} from "../src/main/game/adapter.js";
import { validateRecipe } from "../src/shared/recipe.js";

const recipe = {
  schemaVersion: 1 as const,
  title: "Brighter battles",
  description: "More damage and extra coins",
  damageMultiplier: 1.2,
  enemyHealthMultiplier: 1,
  coinMultiplier: 1.5,
};
async function tempRoot() {
  const base = path.resolve(".local");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, "game-test-"));
}
test("package crosses clean profiles and rejects tampering and unexpected fields", async () => {
  const root = await tempRoot();
  try {
    await createProfile(root, "one");
    await createProfile(root, "two");
    const first = await installRecipe(root, "one", recipe);
    const exported = exportPackage(recipe);
    const imported = importPackage(exported);
    const second = await installRecipe(root, "two", imported.recipe);
    assert.equal(first.hash, second.hash);
    await installRecipe(root, "one", { ...recipe, coinMultiplier: 2 });
    await assert.rejects(
      installRecipe(root, "one", { ...recipe, coinMultiplier: 100 }),
    );
    await revertVersion(root, "one", first.hash);
    assert.equal((await readProfile(root, "one")).hash, first.hash);
    const changed = JSON.parse(exported);
    changed.recipe.coinMultiplier = 3;
    assert.throws(() => importPackage(JSON.stringify(changed)), /integrity/);
    assert.throws(
      () =>
        importPackage(
          JSON.stringify({ ...JSON.parse(exported), files: ["../../x"] }),
        ),
      /fields/,
    );
    assert.throws(() => validateRecipe({ ...recipe, damageMultiplier: NaN }));
    assert.throws(() =>
      validateRecipe({ ...recipe, damageMultiplier: Infinity }),
    );
    assert.throws(
      () => validateRecipe({ ...recipe, enemySpeedMultiplier: 1.2 }),
      /fields/,
    );
    assert.throws(() => validateRecipe({ ...recipe, executable: "code" }));
    await assert.rejects(installRecipe(root, "../escape", recipe));
    await assert.rejects(revertVersion(root, "one", "../escape"));
    assert.deepEqual(
      JSON.parse(
        await fs.readFile(
          path.join(root, "profiles", "one", "current.json"),
          "utf8",
        ),
      ),
      { recipeHash: first.hash },
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("missing build prerequisites and invalid edits retain the last recipe", async () => {
  const root = await tempRoot();
  try {
    await createProfile(root, "one");
    const first = await installRecipe(root, "one", recipe);
    await assert.rejects(
      buildRuntime(
        root,
        "one",
        root,
        path.resolve("runtime/ModaloreRules"),
        recipe,
      ),
      /runtime is missing/,
    );
    await assert.rejects(
      installRecipe(root, "one", { ...recipe, coinMultiplier: Infinity }),
    );
    assert.equal((await readProfile(root, "one")).hash, first.hash);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("persistent profile lock prevents mutations even without an in-memory lock", async () => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, "one");
    const installed = await installRecipe(root, "one", recipe);
    const lock = path.join(profile, "profile.lock");
    await fs.writeFile(
      lock,
      JSON.stringify({
        pid: process.pid,
        token: "01234567-89ab-cdef-0123-456789abcdef",
      }),
    );
    await assert.rejects(
      installRecipe(root, "one", recipe),
      /profile lock is active/,
    );
    await assert.rejects(
      revertVersion(root, "one", installed.hash),
      /profile lock is active/,
    );
    await assert.rejects(
      snapshotProfile(root, "one"),
      /profile lock is active/,
    );
    await assert.rejects(
      buildRuntime(root, "one", root, root, recipe),
      /profile lock is active/,
    );
    await assert.rejects(
      launchProfile(root, "one", root, root),
      /profile lock is active/,
    );
    await fs.writeFile(lock, "{invalid");
    await assert.rejects(
      installRecipe(root, "one", recipe),
      /invalid or unreadable/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("recovery restores interrupted save swap and incomplete mod installation", async () => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, "one");
    const suffix = "01234567-89ab-cdef-0123-456789abcdef";
    const saves = path.join(profile, "saves");
    await fs.writeFile(path.join(saves, "marker"), "original");
    const backup = `previous-${suffix}`,
      stage = `restore-${suffix}`;
    await fs.mkdir(path.join(profile, stage));
    await fs.writeFile(
      path.join(profile, "restore-journal.json"),
      JSON.stringify({ staging: stage, backup }),
    );
    await fs.rename(saves, path.join(profile, backup));
    await recoverProfile(root, "one");
    assert.equal(
      await fs.readFile(path.join(saves, "marker"), "utf8"),
      "original",
    );
    const mods = path.join(saves, "Mods"),
      tx = path.join(profile, "install-recovery");
    await fs.mkdir(mods);
    await fs.mkdir(tx);
    await fs.writeFile(path.join(tx, "mod.backup"), "old mod");
    await fs.writeFile(path.join(tx, "enabled.backup"), "old enabled");
    await fs.writeFile(
      path.join(tx, "manifest.json"),
      JSON.stringify({ hadMod: true, hadEnabled: true }),
    );
    await fs.writeFile(path.join(mods, "ModaloreRules.tmod"), "new mod");
    await fs.writeFile(path.join(mods, "enabled.json"), "new enabled");
    await recoverProfile(root, "one");
    assert.equal(
      await fs.readFile(path.join(mods, "ModaloreRules.tmod"), "utf8"),
      "old mod",
    );
    assert.equal(
      await fs.readFile(path.join(mods, "enabled.json"), "utf8"),
      "old enabled",
    );
    await fs.writeFile(
      path.join(profile, "restore-journal.json"),
      JSON.stringify({ staging: "../outside", backup }),
    );
    await assert.rejects(recoverProfile(root, "one"), /Invalid restore/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("canceling a long build removes staging and preserves the current recipe", async () => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, "one");
    const installed = await installRecipe(root, "one", recipe);
    const game = path.join(root, "fake-tmodloader");
    await fs.mkdir(path.join(game, "dotnet"), { recursive: true });
    await fs.writeFile(path.join(game, "package.json"), '{"type":"commonjs"}');
    await fs.copyFile(
      process.execPath,
      path.join(
        game,
        "dotnet",
        process.platform === "win32" ? "dotnet.exe" : "dotnet",
      ),
    );
    await fs.writeFile(
      path.join(game, "tModLoader.dll"),
      "setTimeout(() => {}, 30000);",
    );
    const controller = new AbortController();
    const task = buildRuntime(
      root,
      "one",
      game,
      path.resolve("runtime/ModaloreRules"),
      recipe,
      { signal: controller.signal },
    );
    const timer = setTimeout(() => controller.abort(), 200);
    try {
      await assert.rejects(task, { name: "AbortError" });
    } finally {
      clearTimeout(timer);
    }
    assert.equal((await readProfile(root, "one")).hash, installed.hash);
    assert.deepEqual(
      (await fs.readdir(profile)).filter((name) => name.startsWith("build-")),
      [],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("checkpoints reject a linked world directory", async (t) => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, "one");
    const external = path.join(root, "external");
    await fs.mkdir(external);
    try {
      await fs.symlink(
        external,
        path.join(profile, "saves", "Worlds"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (e) {
      if (
        ["EPERM", "EACCES", "ENOTSUP"].includes(
          (e as NodeJS.ErrnoException).code ?? "",
        )
      ) {
        t.skip("Filesystem does not permit directory links");
        return;
      }
      throw e;
    }
    await assert.rejects(snapshotProfile(root, "one"), /real directory/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("simulated tool builds and starts a profile without claiming gameplay", async () => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, "one");
    await installRecipe(root, "one", recipe);
    const game = path.join(root, "fake-tmodloader");
    await fs.mkdir(path.join(game, "dotnet"), { recursive: true });
    await fs.writeFile(path.join(game, "package.json"), '{"type":"commonjs"}');
    await fs.copyFile(
      process.execPath,
      path.join(
        game,
        "dotnet",
        process.platform === "win32" ? "dotnet.exe" : "dotnet",
      ),
    );
    const script = `const fs = require('node:fs'); const path = require('node:path'); const args = process.argv.slice(2); if (args.includes('-build')) { const save = args[args.indexOf('-tmlsavedirectory') + 1]; fs.mkdirSync(path.join(save, 'Mods'), {recursive:true}); fs.writeFileSync(path.join(save, 'Mods', 'ModaloreRules.tmod'), 'fake test artifact'); } else { console.log('simulated launch'); setTimeout(() => {}, 1000); }`;
    await fs.writeFile(path.join(game, "tModLoader.dll"), script);
    const built = await buildRuntime(
      root,
      "one",
      game,
      path.resolve("runtime/ModaloreRules"),
      recipe,
    );
    const launched = await launchProfile(root, "one", game, built.stage);
    assert.equal(launched.evidence.launch, "process-started");
    assert.equal(launched.evidence.gameplay, false);
    assert.ok(launched.snapshotId);
    await assert.rejects(installRecipe(root, "one", recipe), /Close the game/);
    assert.equal(await readLatestCheckpoint(root, "one"), launched.snapshotId);
    assert.equal(
      await fs.readFile(
        path.join(profile, "saves", "Mods", "enabled.json"),
        "utf8",
      ),
      '["ModaloreRules"]',
    );
    await new Promise((resolve) => setTimeout(resolve, 1300));
    assert.match(
      await fs.readFile(launched.logPath, "utf8"),
      /simulated launch/,
    );
    const mods = path.join(profile, "saves", "Mods");
    await fs.writeFile(
      path.join(mods, "ModaloreRules.tmod"),
      "previous artifact",
    );
    await fs.writeFile(path.join(mods, "enabled.json"), '["previous"]');
    await fs.writeFile(
      path.join(
        game,
        "dotnet",
        process.platform === "win32" ? "dotnet.exe" : "dotnet",
      ),
      "invalid executable",
    );
    await assert.rejects(launchProfile(root, "one", game, built.stage));
    assert.equal(
      await fs.readFile(path.join(mods, "ModaloreRules.tmod"), "utf8"),
      "previous artifact",
    );
    assert.equal(
      await fs.readFile(path.join(mods, "enabled.json"), "utf8"),
      '["previous"]',
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("save checkpoint restores profile data and a failed restore keeps current saves", async () => {
  const root = await tempRoot();
  try {
    const profile = await createProfile(root, "one");
    await fs.mkdir(path.join(profile, "saves", "Worlds"));
    const save = path.join(profile, "saves", "Worlds", "world.wld");
    await fs.mkdir(path.join(profile, "saves", "Mods"));
    const mod = path.join(profile, "saves", "Mods", "example.tmod");
    await fs.writeFile(save, "before");
    const snap = await snapshotProfile(root, "one");
    await fs.writeFile(save, "after");
    await fs.writeFile(mod, "new mod");
    await assert.rejects(restoreSnapshot(root, "one", "missing"));
    assert.equal(await fs.readFile(save, "utf8"), "after");
    await restoreSnapshot(root, "one", snap);
    assert.equal(await fs.readFile(save, "utf8"), "before");
    assert.equal(await fs.readFile(mod, "utf8"), "new mod");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("source generation only inserts validated numbers and launch requires a real profile", async () => {
  const source = await generateRuntimeSource(
    path.resolve("runtime/ModaloreRules/ModaloreRules.cs"),
    recipe,
  );
  assert.match(source, /FinalDamage \*= 1\.2f/);
  assert.doesNotMatch(source, /__DAMAGE__/);
  await assert.rejects(
    generateRuntimeSource(
      path.resolve("runtime/ModaloreRules/ModaloreRules.cs"),
      { ...recipe, damageMultiplier: "1;evil()" },
    ),
  );
  const root = await tempRoot();
  try {
    await createProfile(root, "one");
    await assert.rejects(
      launchProfile(root, "one", root, path.join(root, "invalid")),
      /Invalid build stage/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
  const found = await detectGame([]);
  assert.deepEqual(found.locations, []);
});
