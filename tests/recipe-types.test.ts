import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRecipe,
  validateLuantiRecipe,
  validateWorkshopRecipe,
} from "../src/shared/recipe.js";
import { exportPackage, importPackage } from "../src/main/game/adapter.js";
const legacy = {
  schemaVersion: 1,
  title: "Test",
  description: "",
  damageMultiplier: 1,
  enemyHealthMultiplier: 1,
  coinMultiplier: 1,
};
const luanti = {
  schemaVersion: 2,
  game: "luanti-minetest-game",
  title: "Test",
  description: "",
  speedMultiplier: 1,
  jumpMultiplier: 2,
  gravityMultiplier: 0.5,
};
test("recipe variants are exact, bounded, canonical and isolated", () => {
  assert.deepEqual(validateWorkshopRecipe(legacy), legacy);
  assert.deepEqual(validateLuantiRecipe(luanti), luanti);
  assert.throws(() => validateRecipe(luanti));
  assert.throws(() => validateLuantiRecipe({ ...luanti, damageMultiplier: 1 }));
  assert.throws(() =>
    validateWorkshopRecipe({ ...legacy, game: "luanti-minetest-game" }),
  );
  for (const value of [NaN, Infinity, 0.49, 3.01])
    assert.throws(() =>
      validateLuantiRecipe({ ...luanti, jumpMultiplier: value }),
    );
  assert.throws(() => validateLuantiRecipe({ ...luanti, game: "other" }));
  assert.equal(
    JSON.stringify(
      validateLuantiRecipe({
        gravityMultiplier: 0.5,
        jumpMultiplier: 2,
        speedMultiplier: 1,
        description: "",
        title: "Test",
        game: "luanti-minetest-game",
        schemaVersion: 2,
      }),
    ),
    JSON.stringify(luanti),
  );
});
test("packages round trip each game and bind the correct dependencies", () => {
  const a = exportPackage(legacy),
    b = exportPackage(luanti);
  assert.deepEqual(importPackage(a).recipe, legacy);
  assert.deepEqual(importPackage(b).recipe, luanti);
  assert.notEqual(importPackage(a).hash, importPackage(b).hash);
  const pkg = JSON.parse(b);
  assert.equal(pkg.version, 2);
  assert.deepEqual(pkg.dependencies, [
    "Luanti",
    "Minetest Game",
    "ModaloreMovement",
  ]);
  pkg.dependencies = ["Terraria", "tModLoader", "ModaloreRules"];
  assert.throws(() => importPackage(JSON.stringify(pkg)));
});
