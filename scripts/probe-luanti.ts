/** Opt-in live Codex and Luanti probe; consumes the configured Codex allowance.
 * Run: npx tsx scripts/probe-luanti.ts <Luanti installation root>
 * All created projects and worlds are isolated under .local.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CodexClient, type CodexApproval } from "../src/main/codex/index.js";
import {
  exportPackage,
  importPackage,
  readProfile,
  restoreSnapshot,
} from "../src/main/game/adapter.js";
import {
  detectLuanti,
  launchLuanti,
  readLuantiReport,
} from "../src/main/game/luanti.js";
import { ProjectStore } from "../src/main/store.js";
import { validateLuantiRecipe } from "../src/shared/recipe.js";

const installation = process.argv[2];
if (!installation || process.argv.length !== 3)
  throw new Error("Provide the Luanti installation root as the only argument");
const root = path.resolve(".local", `luanti-journey-${randomUUID()}`);
const workspace = path.join(root, "workspace"),
  data = path.join(root, "data"),
  recipeFile = path.join(workspace, "recipe.json");
const runtimeTemplate = path.resolve("runtime", "luanti");
const store = new ProjectStore(data);
const client = new CodexClient();
const controllers = new Set<AbortController>();
const samePath = (a: string, b: string) =>
  process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
const approve = async (
  request: CodexApproval,
): Promise<"accept" | "decline"> => {
  const exact =
    request.kind === "fileChange" &&
    !request.grantRoot &&
    request.paths.length === 1 &&
    samePath(path.resolve(workspace, request.paths[0]), recipeFile);
  console.log(
    `Approval requested: ${request.kind}; ${exact ? "approved exact recipe patch" : "declined"}`,
  );
  return exact ? "accept" : "decline";
};
const readRecipe = async () =>
  validateLuantiRecipe(JSON.parse(await fs.readFile(recipeFile, "utf8")));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitUnlocked(id: string) {
  const file = path.join(data, "profiles", id, "profile.lock");
  for (let i = 0; i < 100; i++) {
    if (!(await fs.lstat(file).catch(() => null))) return;
    await wait(100);
  }
  throw new Error("Owned Luanti process did not release its profile lock");
}
async function play(id: string) {
  const controller = new AbortController();
  controllers.add(controller);
  try {
    const launch = await launchLuanti(
      data,
      id,
      installation!,
      runtimeTemplate,
      { signal: controller.signal },
    );
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const report = await readLuantiReport(data, id, launch.sessionId);
      if (report) {
        assert.equal(
          report.matches,
          true,
          "Engine physics readback did not match",
        );
        return { snapshotId: launch.snapshotId, report };
      }
      await wait(250);
    }
    throw new Error("Timed out waiting for connected-player physics readback");
  } finally {
    controller.abort();
    await waitUnlocked(id);
    controllers.delete(controller);
  }
}
let stage = "checking prerequisites";
try {
  const detection = await detectLuanti([installation]);
  if (!detection.found || detection.version !== "5.18.0")
    throw new Error("Supported Luanti installation not found");
  await fs.mkdir(workspace, { recursive: true });
  if (!(await client.getStatus()).signedIn)
    throw new Error("Codex is not signed in");
  console.log(
    "Codex connected using configured default model; verified Luanti 5.18.0 installation.",
  );
  stage = "creating recipe with Codex";
  const first = await client.runTurn({
    workspace,
    timeoutMs: 120000,
    onApproval: approve,
    prompt:
      'Create recipe.json in this workspace containing exactly these fields and values: schemaVersion: 2, game: "luanti-minetest-game", title: "Movement Trial", description: "A small movement test", speedMultiplier: 1.5, jumpMultiplier: 1, gravityMultiplier: 1. It must be valid JSON. Do not run commands or change any other file.',
  });
  assert.equal(
    first.status,
    "completed",
    `Creation failed: ${first.errorCode ?? first.status}`,
  );
  const original = await readRecipe();
  assert.deepEqual(original, {
    schemaVersion: 2,
    game: "luanti-minetest-game",
    title: "Movement Trial",
    description: "A small movement test",
    speedMultiplier: 1.5,
    jumpMultiplier: 1,
    gravityMultiplier: 1,
  });
  const project = await store.create(original);
  stage = "revising recipe with Codex";
  const second = await client.runTurn({
    workspace,
    threadId: first.threadId,
    timeoutMs: 120000,
    onApproval: approve,
    prompt:
      "Change only jumpMultiplier to 1.4 and gravityMultiplier to 0.8 in recipe.json. Keep all other fields exactly as they are. Do not run commands or change any other file.",
  });
  assert.equal(
    second.status,
    "completed",
    `Revision failed: ${second.errorCode ?? second.status}`,
  );
  const revised = await readRecipe();
  assert.deepEqual(revised, {
    ...original,
    jumpMultiplier: 1.4,
    gravityMultiplier: 0.8,
  });
  const updated = await store.update(project.id, revised);
  assert.equal(updated.parentHash, project.hash);
  assert.notEqual(updated.hash, project.hash);
  const marker = path.join(
    data,
    "profiles",
    project.id,
    "saves",
    "Worlds",
    "checkpoint-marker.txt",
  );
  await fs.mkdir(path.dirname(marker), { recursive: true });
  await fs.writeFile(marker, "before launch");
  stage = "launching source profile";
  const sourcePlay = await play(project.id);
  assert.deepEqual(sourcePlay.report.requested, {
    speed: 1.5,
    jump: 1.4,
    gravity: 0.8,
  });
  console.log("Source profile connected and engine physics readback matched.");
  stage = "exporting and importing";
  const exported = exportPackage(revised, project.hash);
  await fs.writeFile(path.join(root, "recipe.modalore.json"), exported, {
    flag: "wx",
  });
  const imported = importPackage(exported);
  assert.equal(imported.parentHash, project.hash);
  const clean = await store.create(
    imported.recipe,
    imported.parentHash ?? undefined,
  );
  assert.equal(clean.hash, updated.hash);
  assert.deepEqual((await readProfile(data, clean.id)).recipe, revised);
  stage = "launching clean imported profile";
  const cleanPlay = await play(clean.id);
  assert.deepEqual(cleanPlay.report.requested, sourcePlay.report.requested);
  console.log(
    "Clean imported profile connected and engine physics readback matched.",
  );
  stage = "restoring checkpoint and recipe";
  await fs.writeFile(marker, "after launch");
  await restoreSnapshot(data, project.id, sourcePlay.snapshotId);
  assert.equal(await fs.readFile(marker, "utf8"), "before launch");
  const restored = await store.revert(project.id);
  assert.equal(restored.hash, project.hash);
  assert.deepEqual(restored.recipe, original);
  assert.equal((await readProfile(data, project.id)).hash, project.hash);
  assert.equal((await readProfile(data, clean.id)).hash, updated.hash);
  stage = "testing cancellation";
  const cancel = new AbortController();
  const cancelled = await client.runTurn({
    workspace,
    threadId: first.threadId,
    timeoutMs: 30000,
    signal: cancel.signal,
    onApproval: async () => "decline",
    onProgress: () => cancel.abort(),
    prompt:
      "Consider changing speedMultiplier to 2, but wait for further instructions before editing any file.",
  });
  assert.equal(cancelled.status, "interrupted");
  assert.equal((await readProfile(data, project.id)).hash, project.hash);
  assert.equal((await readProfile(data, clean.id)).hash, updated.hash);
  const evidence = {
    scope: "Opt-in isolated Codex-to-Luanti single-player integration probe",
    engine: "Luanti 5.18.0",
    game: "Minetest Game",
    gameId: detection.gameId,
    requested: sourcePlay.report.requested,
    sourceObserved: sourcePlay.report.observed,
    cleanImportObserved: cleanPlay.report.observed,
    checks: {
      codexCreateAndRevise: true,
      sourcePlayerPhysicsReadback: true,
      exportedWithParentHash: true,
      cleanImportPlayerPhysicsReadback: true,
      isolatedCheckpointRestored: true,
      earlierRecipeHashRestored: true,
      interruptedTurnLeftProfilesUnchanged: true,
    },
    limitation:
      "Connected-player physics override API readback only; physical movement was not observed. Game, profiles and saves were isolated under the probe directory.",
  };
  await fs.writeFile(
    path.resolve("docs/luanti-verification.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "Checkpoint, recipe history and cancellation checks passed. Saved sanitized verification evidence.",
  );
} catch (error) {
  console.error(
    `Probe failed while ${stage}: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
} finally {
  for (const controller of controllers) controller.abort();
  client.close();
}
