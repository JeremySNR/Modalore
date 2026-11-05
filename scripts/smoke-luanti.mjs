/** Opt-in real Windows desktop/game test. Downloads ~23 MB into .local, opens
 * isolated game sessions, and leaves the test data for inspection.
 * No Codex allowance is used; probe-luanti.ts covers the real Codex path. */
import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const data = path.resolve(".local", `luanti-desktop-${Date.now()}`);
await fs.mkdir(data, { recursive: true });
const env = { ...process.env, MODALORE_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
delete env.MODALORE_LUANTI_DIR;
const executablePath = process.argv[2];
const selectedRuntime = process.env.MODALORE_TEST_LUANTI_ROOT;
const app = await electron.launch({
  ...(executablePath ? { executablePath, args: [] } : { args: ["."] }),
  env,
  timeout: 30000,
});
const projects = [];
const world = (id) =>
  path.join(data, "profiles", id, "saves", "Worlds", "luanti");
const profileLock = (id) => path.join(data, "profiles", id, "profile.lock");
async function autoClose(id) {
  const mod = path.join(world(id), "worldmods", "modalore_test_shutdown");
  await fs.mkdir(mod, { recursive: true });
  await fs.writeFile(
    path.join(mod, "mod.conf"),
    "name = modalore_test_shutdown\n",
  );
  // Test-only helper performs no world/physics changes, just graceful shutdown.
  await fs.writeFile(
    path.join(mod, "init.lua"),
    "core.after(10, function() core.request_shutdown('Desktop test complete', false, 0) end)\n",
  );
}
async function waitClosed(id) {
  await expect
    .poll(
      async () =>
        fs.stat(profileLock(id)).then(
          () => true,
          () => false,
        ),
      { timeout: 20000 },
    )
    .toBe(false);
}
try {
  const page = await app.firstWindow();
  await page.waitForSelector(".feature");
  await page.evaluate(() =>
    window.modalore.onProgress((event) => {
      window.__smokeProgress = event;
    }),
  );
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  if (selectedRuntime) {
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, path.resolve(selectedRuntime));
    await page
      .getByRole("button", { name: "Choose folder", exact: true })
      .first()
      .click();
  } else {
    await page
      .getByRole("button", { name: "Set up free game", exact: true })
      .click();
  }
  await expect
    .poll(
      async () => {
        const progress = await page.evaluate(() => window.__smokeProgress);
        if (progress?.status === "error" || progress?.status === "cancelled")
          throw new Error(progress.message);
        return (await page.evaluate(() => window.modalore.snapshot())).luanti
          ?.found;
      },
      { timeout: 300000 },
    )
    .toBe(true);
  const installed = (await page.evaluate(() => window.modalore.snapshot()))
    .luanti;
  assert.equal(installed.version, "5.18.0");
  if (!selectedRuntime)
    assert.equal(path.relative(data, installed.path).startsWith(".."), false);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: /Long strides/ }).click();
  await page.getByRole("button", { name: "Make it mine", exact: true }).click();
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.modalore.snapshot())).projects.length,
    )
    .toBe(1);
  const original = (await page.evaluate(() => window.modalore.snapshot()))
    .projects[0];
  projects.push(original.id);
  await autoClose(original.id);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your player joined with the requested",
    { timeout: 30000 },
  );
  const originalReport = JSON.parse(
    await fs.readFile(
      path.join(world(original.id), "modalore-physics.json"),
      "utf8",
    ),
  );
  assert.equal(originalReport.matches, true);
  assert.equal(originalReport.requested.speed, 1.5);
  await waitClosed(original.id);
  const hashWorld = async (id) =>
    createHash("sha256")
      .update(await fs.readFile(path.join(world(id), "map.sqlite")))
      .digest("hex");
  const firstWorldHash = await hashWorld(original.id);
  const firstMapMetadata = await fs.readFile(
    path.join(world(original.id), "map_meta.txt"),
    "utf8",
  );
  await page.getByRole("slider", { name: /Speed/ }).fill("2");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Save adjustments", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Project saved to your library",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your player joined with the requested",
    { timeout: 30000 },
  );
  const revisedReport = JSON.parse(
    await fs.readFile(
      path.join(world(original.id), "modalore-physics.json"),
      "utf8",
    ),
  );
  assert.equal(revisedReport.matches, true);
  assert.equal(revisedReport.requested.speed, 2);
  assert.notEqual(revisedReport.session, originalReport.session);
  await waitClosed(original.id);
  assert.equal(
    await fs.readFile(path.join(world(original.id), "map_meta.txt"), "utf8"),
    firstMapMetadata,
  );
  const worldBefore = await hashWorld(original.id);
  const shared = path.join(data, "shared.modalore.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, shared);
  await page
    .getByRole("button", { name: "Export this version", exact: true })
    .click();
  await expect
    .poll(() =>
      fs.stat(shared).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true);
  const exported = await fs.readFile(shared, "utf8");
  assert.equal(JSON.parse(exported).recipe.speedMultiplier, 2);
  assert.equal(JSON.parse(exported).parentHash, original.hash);
  const clean = await page.evaluate(() => window.modalore.importProject());
  assert.notEqual(clean.id, original.id);
  projects.push(clean.id);
  assert.equal(
    await fs.stat(path.join(world(clean.id), "map.sqlite")).then(
      () => true,
      () => false,
    ),
    false,
  );
  await page.evaluate((id) => window.modalore.exportProject(id), clean.id);
  assert.equal(await fs.readFile(shared, "utf8"), exported);
  await autoClose(clean.id);
  const playResult = await page.evaluate(
    (id) => window.modalore.play(id),
    clean.id,
  );
  assert.match(playResult.message, /Your player joined with the requested/);
  const cleanReport = JSON.parse(
    await fs.readFile(
      path.join(world(clean.id), "modalore-physics.json"),
      "utf8",
    ),
  );
  assert.deepEqual(cleanReport.requested, revisedReport.requested);
  assert.equal(cleanReport.matches, true);
  await waitClosed(clean.id);
  assert.equal(await hashWorld(original.id), worldBefore);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async (_window, options) => ({
      response: options.buttons.includes("Restore save checkpoint") ? 2 : 1,
      checkboxChecked: false,
    });
  });
  const recovery = await page.evaluate(
    (id) => window.modalore.restore(id),
    original.id,
  );
  assert.match(recovery.message, /checkpoint restored/);
  assert.equal(await hashWorld(original.id), firstWorldHash);
  // A test-only failing mod proves the real engine exit and log reach the UI.
  // Recipe packages cannot carry this code; it is inserted only in our test world.
  const failure = await page.evaluate(
    (recipe) =>
      window.modalore.createProject({
        ...recipe,
        title: "Startup failure test",
      }),
    original.recipe,
  );
  projects.push(failure.id);
  const failureMod = path.join(
    world(failure.id),
    "worldmods",
    "modalore_test_failure",
  );
  await fs.mkdir(failureMod, { recursive: true });
  await fs.writeFile(
    path.join(failureMod, "mod.conf"),
    "name = modalore_test_failure\n",
  );
  await fs.writeFile(
    path.join(failureMod, "init.lua"),
    "error('MODALORE_PROBE_STARTUP_FAILURE')\n",
  );
  await page.reload();
  await page.waitForSelector(".feature");
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await page.getByRole("button", { name: /Startup failure test/ }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "The game closed before your player joined",
    { timeout: 30000 },
  );
  await expect(page.getByRole("status")).not.toContainText(
    "Error invoking remote method",
  );
  await page.getByRole("button", { name: /Technical details/ }).click();
  await expect(page.locator("pre")).toContainText(
    "MODALORE_PROBE_STARTUP_FAILURE",
  );
  await waitClosed(failure.id);
  assert.equal(
    (await page.evaluate(() => window.modalore.snapshot())).projects.find(
      (p) => p.id === failure.id,
    ).hash,
    failure.hash,
  );
  // Replace the fault with a shutdown helper, then retry the very same profile.
  await fs.writeFile(
    path.join(failureMod, "init.lua"),
    "core.after(10,function() core.request_shutdown('Retry complete',false,0) end)\n",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your player joined with the requested",
    { timeout: 30000 },
  );
  await waitClosed(failure.id);
  const report = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    packaged: !!executablePath,
    engine: installed.version,
    gameCommit: "9e895af6e9feb98332fa1a778001442f5669bc20",
    checks: [
      selectedRuntime
        ? "existing pinned runtime selected through the native folder picker"
        : "official engine and pinned game downloaded and hash-verified through desktop setup",
      "created recipe and launched from native UI",
      "real connected player physics matched requested settings",
      "edited speed after playing and relaunched the same world with a fresh matching report",
      "world-generation metadata preserved across recipe revision",
      "export/import/re-export byte-identical in a fresh profile",
      "fresh imported world launched with identical player physics",
      "original test world database unchanged by imported-world play",
      "checkpoint restore returned the exact pre-revision world database",
      "actual engine startup error surfaced in UI with bounded game log and no internal IPC prefix",
      "failed launch kept the recipe and released the profile for a successful retry",
    ],
    observed: cleanReport.observed,
    limits:
      "Physics API readback and filesystem recovery were checked. Physical movement and a human playing the game were not observed in this desktop test. Test-only mods closed successful sessions after 10 seconds each and deliberately failed one startup. Native export/import and destructive recovery dialogs use test-selected answers.",
  };
  await fs.writeFile(
    "docs/luanti-desktop-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  // Only these fresh test profiles can contain processes started by this test.
  for (const id of projects) {
    const lock = await fs
      .readFile(profileLock(id), "utf8")
      .then(JSON.parse, () => null);
    if (lock?.pid)
      await app
        .evaluate((_electron, pid) => {
          try {
            process.kill(pid);
          } catch {}
        }, lock.pid)
        .catch(() => {});
  }
  await app.close();
}
