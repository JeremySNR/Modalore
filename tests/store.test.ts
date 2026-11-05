import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ProjectStore } from "../src/main/store.js";
import {
  installRecipe,
  readProfile,
  exportPackage,
} from "../src/main/game/adapter.js";

test("saved projects survive restart, invalid updates preserve current recipe, revert keeps history", async () => {
  const root = path.resolve(".local", `store-test-${randomUUID()}`);
  try {
    const first = new ProjectStore(root);
    const recipe = {
      schemaVersion: 1,
      title: "My first creation",
      description: "Test recipe",
      damageMultiplier: 1,
      enemyHealthMultiplier: 1,
      coinMultiplier: 1,
    };
    const project = await first.create(recipe);
    const reopened = new ProjectStore(root);
    assert.equal((await reopened.list())[0].id, project.id);
    await assert.rejects(
      reopened.update(project.id, { ...recipe, damageMultiplier: Infinity }),
    );
    assert.equal((await reopened.read(project.id)).hash, project.hash);
    const updated = await reopened.update(project.id, {
      ...recipe,
      coinMultiplier: 2,
    });
    assert.equal(updated.parentHash, project.hash);
    assert.equal(updated.previousRecipes.length, 1);
    const reverted = await reopened.revert(project.id);
    assert.equal(reverted.hash, project.hash);
    assert.equal(reverted.parentHash, project.parentHash);
    assert.equal(
      exportPackage(reverted.recipe, reverted.parentHash),
      exportPackage(project.recipe, project.parentHash),
    );
    await assert.rejects(reopened.revert(project.id), /no earlier/);
    await assert.rejects(reopened.read("../secret"), /Invalid project/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("interrupted metadata commit rolls back pointer with original history and attribution", async () => {
  const root = path.resolve(".local", `store-crash-${randomUUID()}`);
  try {
    const store = new ProjectStore(root);
    const recipe = {
      schemaVersion: 1,
      title: "Committed",
      description: "",
      damageMultiplier: 1,
      enemyHealthMultiplier: 1,
      coinMultiplier: 1,
    };
    const project = await store.create(recipe, "a".repeat(64));
    await installRecipe(root, project.id, { ...recipe, coinMultiplier: 3 });
    const recovered = await new ProjectStore(root).read(project.id);
    assert.equal(recovered.hash, project.hash);
    assert.equal(recovered.parentHash, "a".repeat(64));
    assert.deepEqual(recovered.previousRecipes, []);
    assert.equal((await readProfile(root, project.id)).hash, project.hash);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("restoring a selected version preserves later versions, ancestry and saves across restart", async () => {
  const root = path.resolve(".local", `store-history-${randomUUID()}`);
  try {
    const store = new ProjectStore(root);
    const recipe = {
      schemaVersion: 1,
      title: "Original",
      description: "",
      damageMultiplier: 1,
      enemyHealthMultiplier: 1,
      coinMultiplier: 1,
    };
    const original = await store.create(recipe, "b".repeat(64));
    const second = await store.update(original.id, {
      ...recipe,
      coinMultiplier: 2,
    });
    const third = await store.update(original.id, {
      ...recipe,
      coinMultiplier: 3,
    });
    const saves = path.join(root, "profiles", original.id, "saves", "Worlds");
    await fs.mkdir(saves, { recursive: true });
    await fs.writeFile(path.join(saves, "precious.wld"), "keep my progress");
    const restarted = new ProjectStore(root);
    const restored = await restarted.restoreVersion(
      original.id,
      third.history[0].id,
    );
    assert.equal(
      exportPackage(restored.recipe, restored.parentHash),
      exportPackage(original.recipe, original.parentHash),
    );
    assert.equal(restored.history.length, 3);
    assert.equal(
      restored.history[1].recipe.coinMultiplier,
      second.recipe.coinMultiplier,
    );
    const latest = await restarted.restoreVersion(
      original.id,
      restored.history[2].id,
    );
    assert.equal(
      exportPackage(latest.recipe, latest.parentHash),
      exportPackage(third.recipe, third.parentHash),
    );
    assert.equal(
      await fs.readFile(path.join(saves, "precious.wld"), "utf8"),
      "keep my progress",
    );
    await assert.rejects(
      restarted.restoreVersion(original.id, "../secret"),
      /Invalid version/,
    );
    const other = await store.create(recipe);
    await assert.rejects(
      restarted.restoreVersion(other.id, third.history[0].id),
      /no longer/,
    );
    assert.equal((await readProfile(root, original.id)).hash, third.hash);
    // A failed metadata commit must not leave the game profile on the requested version.
    const failing = new ProjectStore(root);
    failing.save = async () => {
      throw new Error("simulated disk failure");
    };
    await assert.rejects(
      failing.restoreVersion(original.id, third.history[0].id),
      /disk failure/,
    );
    assert.equal((await readProfile(root, original.id)).hash, third.hash);
    assert.equal((await restarted.read(original.id)).hash, third.hash);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("archive survives restart, blocks edits and keeps the full project recoverable", async () => {
  const root = path.resolve(".local", `store-archive-${randomUUID()}`);
  try {
    const store = new ProjectStore(root);
    const recipe = {
      schemaVersion: 1,
      title: "Keep this",
      description: "",
      damageMultiplier: 1,
      enemyHealthMultiplier: 1,
      coinMultiplier: 1,
    };
    const original = await store.create(recipe);
    const updated = await store.update(original.id, {
      ...recipe,
      coinMultiplier: 2,
    });
    const archived = await store.archive(original.id);
    assert.ok(archived.archivedAt);
    const reopened = new ProjectStore(root);
    assert.equal((await reopened.list())[0].archivedAt, archived.archivedAt);
    assert.equal(
      (await reopened.archive(original.id)).archivedAt,
      archived.archivedAt,
    );
    await assert.rejects(reopened.update(original.id, recipe), /Archived/);
    await assert.rejects(
      reopened.restoreVersion(original.id, updated.history[0].id),
      /Archived/,
    );
    await assert.rejects(reopened.revert(original.id), /Archived/);
    assert.equal((await readProfile(root, original.id)).hash, updated.hash);
    const recovered = await reopened.unarchive(original.id);
    assert.deepEqual(recovered, updated);
    assert.deepEqual(
      (await new ProjectStore(root).readActive(original.id)).history,
      updated.history,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("legacy history migrates without fabricated dates and invalid records fail before changing profile", async () => {
  const root = path.resolve(".local", `store-migrate-${randomUUID()}`);
  try {
    const store = new ProjectStore(root);
    const recipe = {
      schemaVersion: 1,
      title: "Legacy",
      description: "",
      damageMultiplier: 1,
      enemyHealthMultiplier: 1,
      coinMultiplier: 1,
    };
    const original = await store.create(recipe);
    const updated = await store.update(original.id, {
      ...recipe,
      coinMultiplier: 2,
    });
    const file = path.join(root, "projects", `${original.id}.json`);
    const legacy: Partial<typeof updated> = { ...updated };
    delete legacy.history;
    await fs.writeFile(file, JSON.stringify(legacy));
    const migrated = await store.read(original.id);
    assert.equal(migrated.history.length, 1);
    assert.equal(migrated.history[0].savedAt, undefined);
    assert.equal(
      (await store.read(original.id)).history[0].id,
      migrated.history[0].id,
    );
    const restored = await store.restoreVersion(
      original.id,
      migrated.history[0].id,
    );
    assert.equal(restored.hash, original.hash);
    await fs.writeFile(
      file,
      JSON.stringify({
        ...restored,
        history: [
          {
            ...restored.history[0],
            recipe: { ...recipe, coinMultiplier: 999 },
          },
        ],
      }),
    );
    await assert.rejects(store.read(original.id));
    assert.equal((await readProfile(root, original.id)).hash, original.hash);
    await fs.writeFile(
      file,
      JSON.stringify({ ...restored, hash: updated.hash }),
    );
    await assert.rejects(store.read(original.id), /Invalid project history/);
    assert.equal((await readProfile(root, original.id)).hash, original.hash);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
