import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createProfile, installRecipe } from "../src/main/game/adapter.js";
import {
  detectLuanti,
  generateLuantiSource,
  readLuantiReport,
} from "../src/main/game/luanti.js";

const recipe = {
  schemaVersion: 2,
  game: "luanti-minetest-game",
  title: "Test",
  description: "",
  speedMultiplier: 1.5,
  jumpMultiplier: 1.4,
  gravityMultiplier: 0.8,
} as const;
const template = path.resolve("runtime/luanti/init.lua");
async function temporary() {
  await fs.mkdir(".local", { recursive: true });
  return fs.mkdtemp(path.resolve(".local/luanti-test-"));
}

test("Luanti runtime substitutes only validated numbers and rejects template changes", async () => {
  const source = await generateLuantiSource(template, recipe);
  assert.match(source, /speed = 1\.5, jump = 1\.4, gravity = 0\.8/);
  assert.match(source, /register_on_respawnplayer/);
  await assert.rejects(
    generateLuantiSource(template, {
      ...recipe,
      speedMultiplier: "1; arbitrary()",
    }),
  );
  const dir = await temporary();
  try {
    const altered = path.join(dir, "init.lua");
    await fs.writeFile(
      altered,
      (await fs.readFile(template, "utf8")) + "\nprint('changed')",
    );
    await assert.rejects(generateLuantiSource(altered, recipe), /integrity/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readback verifies current requested values and computes mismatch", async () => {
  const dir = await temporary();
  try {
    await createProfile(dir, "one");
    await installRecipe(dir, "one", recipe);
    const world = path.join(
      dir,
      "profiles",
      "one",
      "saves",
      "Worlds",
      "luanti",
    );
    await fs.mkdir(world, { recursive: true });
    const file = path.join(world, "modalore-physics.json");
    const report = {
      session: 123,
      requested: { speed: 1.5, jump: 1.4, gravity: 0.8 },
      observed: { speed: 1, jump: 1.4, gravity: 0.8 },
      matches: false,
      engine: { string: "5.18.0" },
      game: { id: "minetest_game", title: "Minetest Game" },
    };
    await fs.writeFile(file, JSON.stringify(report));
    assert.equal((await readLuantiReport(dir, "one", 123))?.matches, false);
    report.game.id = "minetest";
    await fs.writeFile(file, JSON.stringify(report));
    assert.equal((await readLuantiReport(dir, "one", 123))?.matches, false);
    await assert.rejects(readLuantiReport(dir, "one", 124), /stale/);
    report.requested.speed = 2;
    await fs.writeFile(file, JSON.stringify(report));
    await assert.rejects(readLuantiReport(dir, "one", 123), /does not match/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("detection rejects missing installation", async () => {
  assert.equal(
    (await detectLuanti([path.resolve(".local/nonexistent-luanti")])).found,
    false,
  );
});
