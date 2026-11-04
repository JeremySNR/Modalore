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
