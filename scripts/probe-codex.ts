/** Opt-in real Codex test. Uses the configured account and consumes its allowance.
 * Run: npx tsx scripts/probe-codex.ts
 * All artifacts are isolated under .local; no game files or Codex configuration are changed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CodexClient, type CodexApproval } from "../src/main/codex/index.js";
import {
  createProfile,
  exportPackage,
  importPackage,
  installRecipe,
  readProfile,
} from "../src/main/game/adapter.js";
import { validateRecipe } from "../src/shared/recipe.js";

const root = path.resolve(".local", `codex-recipe-probe-${randomUUID()}`);
const workspace = path.join(root, "workspace");
const profileRoot = path.join(root, "profiles-data");
const recipePath = path.join(workspace, "recipe.json");
const client = new CodexClient();
const samePath = (a: string, b: string) =>
  process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
const approve = async (
  request: CodexApproval,
): Promise<"accept" | "decline"> => {
  const exact =
    request.kind === "fileChange" &&
    !request.grantRoot &&
    request.paths.length === 1 &&
    samePath(path.resolve(workspace, request.paths[0]), recipePath);
  console.log(
    `Approval requested: ${request.kind}; ${exact ? "approved exact recipe patch" : "declined"}`,
  );
  return exact ? "accept" : "decline";
};
const readRecipe = async () =>
  validateRecipe(JSON.parse(await fs.readFile(recipePath, "utf8")));
const schema =
  "JSON object with exactly these fields: schemaVersion (number 1), title (non-empty string, max 80 characters), description (string, max 500 characters), damageMultiplier, enemyHealthMultiplier, coinMultiplier (finite numbers between 0.5 and 3).";
try {
  await fs.mkdir(workspace, { recursive: true });
  const status = await client.getStatus();
  if (!status.signedIn) throw new Error("Codex is not signed in");
  console.log("Codex connected. Using configured default model.");
  const first = await client.runTurn({
    workspace,
    timeoutMs: 120000,
    onApproval: approve,
    prompt: `Create recipe.json in this workspace. ${schema} Set title to "Treasure Trial", description to "A small test recipe", damageMultiplier to 1.2, enemyHealthMultiplier to 1.1, and coinMultiplier to 1. Do not run commands or change any other file.`,
  });
  assert.equal(
    first.status,
    "completed",
    `Creation failed: ${first.errorCode ?? first.status}`,
  );
  const original = await readRecipe();
  assert.equal(original.coinMultiplier, 1);
  assert.equal(original.enemyHealthMultiplier, 1.1);
  await createProfile(profileRoot, "source");
  const initial = await installRecipe(profileRoot, "source", original);
  console.log("Created and validated initial recipe in isolated profile.");

  const second = await client.runTurn({
    workspace,
    threadId: first.threadId,
    timeoutMs: 120000,
    onApproval: approve,
    prompt:
      "Change only coinMultiplier in recipe.json from 1 to 2. Keep all other fields exactly as they are. Do not run commands or change any other file.",
  });
  assert.equal(
    second.status,
    "completed",
    `Revision failed: ${second.errorCode ?? second.status}`,
  );
  const revised = await readRecipe();
  assert.deepEqual(revised, { ...original, coinMultiplier: 2 });
  const installed = await installRecipe(profileRoot, "source", revised);
  assert.notEqual(initial.hash, installed.hash);
  const packageText = exportPackage(revised, initial.hash);
  await fs.writeFile(path.join(root, "recipe.modalore.json"), packageText, {
    flag: "wx",
  });
  const imported = importPackage(
    await fs.readFile(path.join(root, "recipe.modalore.json"), "utf8"),
  );
  assert.equal(imported.parentHash, initial.hash);
  await createProfile(profileRoot, "clean");
  const clean = await installRecipe(profileRoot, "clean", imported.recipe);
  assert.equal(clean.hash, installed.hash);
  assert.deepEqual((await readProfile(profileRoot, "clean")).recipe, revised);
  console.log(
    "Revised recipe exported, imported and matched in a clean profile.",
  );

  const controller = new AbortController();
  const cancelled = await client.runTurn({
    workspace,
    threadId: first.threadId,
    timeoutMs: 30000,
    signal: controller.signal,
    onApproval: async () => "decline",
    onProgress: () => controller.abort(),
    prompt:
      "Consider changing coinMultiplier to 3, but wait for further instructions before editing any file.",
  });
  assert.equal(cancelled.status, "interrupted");
  assert.equal((await readProfile(profileRoot, "source")).hash, installed.hash);
  assert.equal((await readProfile(profileRoot, "clean")).hash, installed.hash);
  console.log(
    "Interrupted turn left both installed recipe versions unchanged.",
  );
  console.log(`Probe artifacts: ${root}`);
  console.log(
    "Evidence: recipe schema and package integrity only; no game build, launch or gameplay was tested.",
  );
} catch (error) {
  // Do not print raw protocol errors, paths from the server, credentials or prompts.
  console.error(
    "Codex recipe probe did not complete; inspect local prerequisites and adapter tests.",
  );
  process.exitCode = 1;
} finally {
  client.close();
}
