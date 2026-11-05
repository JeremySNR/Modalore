import { _electron as electron, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
const data = path.resolve(".local", `desktop-smoke-${Date.now()}`);
await fs.mkdir(data, { recursive: true });
const env = { ...process.env, MODALORE_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
const started = performance.now();
const executablePath = process.argv[2];
const app = await electron.launch({
  ...(executablePath ? { executablePath, args: [] } : { args: ["."] }),
  env,
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector(".feature");
  const readyMs = Math.round(performance.now() - started);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  assert.equal(
    await page.evaluate(() => typeof window.modalore?.createProject),
    "function",
  );
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  const recipe = {
    schemaVersion: 1,
    title: "Native smoke test",
    description: "Created through the real Electron bridge.",
    damageMultiplier: 1.2,
    enemyHealthMultiplier: 1,
    coinMultiplier: 1.5,
  };
  const project = await page.evaluate(
    (r) => window.modalore.createProject(r),
    recipe,
  );
  const updated = await page.evaluate(
    ({ id, recipe }) =>
      window.modalore.updateProject(id, { ...recipe, coinMultiplier: 2 }),
    { id: project.id, recipe },
  );
  assert.equal(updated.recipe.coinMultiplier, 2);
  const snapshot = await page.evaluate(() => window.modalore.snapshot());
  assert.equal(snapshot.projects.length, 1);
  const packageFile = path.join(data, "export.modalore.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, packageFile);
  await page.evaluate((id) => window.modalore.exportProject(id), project.id);
  const originalPackage = await fs.readFile(packageFile, "utf8");
  const imported = await page.evaluate(() => window.modalore.importProject());
  assert.notEqual(imported.id, project.id);
  assert.deepEqual(imported.recipe, updated.recipe);
  await page.evaluate((id) => window.modalore.exportProject(id), imported.id);
  assert.equal(await fs.readFile(packageFile, "utf8"), originalPackage);
  assert.equal(
    (await page.evaluate(() => window.modalore.snapshot())).projects.length,
    2,
  );
  await page.reload();
  await page.waitForSelector(".feature");
  const nav = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await page.getByRole("button", { name: "My library", exact: true }).click();
    await page
      .getByRole("heading", { name: "Native smoke test" })
      .first()
      .waitFor();
    nav.push(Math.round(performance.now() - start));
    await page.getByRole("button", { name: "Discover", exact: true }).click();
  }
  await page.getByRole("button", { name: "My library", exact: true }).click();
  // The imported copy has no local history; open the original project explicitly.
  const originalIndex = (
    await page.evaluate(() => window.modalore.snapshot())
  ).projects.findIndex((p) => p.id === project.id);
  await page.locator("button.project-row").nth(originalIndex).click();
  await expect(page.locator(".history-panel summary")).toBeVisible();
  await page.locator(".history-panel summary").click();
  const restore = page
    .getByRole("button", { name: "Restore", exact: true })
    .first();
  await restore.click();
  const versionDialog = page.getByRole("dialog");
  await expect(versionDialog).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    versionDialog.getByRole("button", { name: "Restore version", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(restore).toBeFocused();
  await restore.click();
  await versionDialog
    .getByRole("button", { name: "Restore version", exact: true })
    .click();
  await expect(versionDialog).toBeHidden();
  await expect(page.getByRole("slider", { name: /Coins/ })).toHaveValue("1.5");
  const afterRestore = (
    await page.evaluate(() => window.modalore.snapshot())
  ).projects.find((p) => p.id === project.id);
  assert.equal(afterRestore.history.length, 2);
  assert.equal(afterRestore.history.at(-1).recipe.coinMultiplier, 2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/desktop-history.png", fullPage: true });
  assert.deepEqual(
    (
      await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
    [],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: path.join(data, "history-narrow.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Archive project", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Archived (1)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Unarchive", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: path.join(data, "archive-narrow.png"),
    fullPage: true,
  });
  assert.deepEqual(
    (
      await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
    [],
  );
  await page.reload();
  const archivedSnapshot = await page.evaluate(() =>
    window.modalore.snapshot(),
  );
  assert.equal(archivedSnapshot.projects.length, 1);
  assert.equal(archivedSnapshot.archivedProjects[0].id, project.id);
  await page
    .getByRole("button", { name: "Toggle navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await page.getByRole("button", { name: "Archived (1)", exact: true }).click();
  await page.getByRole("button", { name: "Unarchive", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Active (2)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archived (0)", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await fs.mkdir("docs", { recursive: true });
  await page.screenshot({ path: "docs/desktop-native.png", fullPage: true });
  const metrics = await app.evaluate(({ app }) =>
    app.getAppMetrics().map((m) => ({
      type: m.type,
      workingSetKB: m.memory.workingSetSize,
      cpu: m.cpu.percentCPUUsage,
    })),
  );
  const report = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    packaged: !!executablePath,
    readyMs,
    navigationAutomationRoundtripMs: nav,
    processes: metrics,
    rendererErrors: errors,
    checks: [
      "real Electron preload",
      "no renderer require",
      "create project",
      "update project",
      "persisted snapshot",
      "real export/import into new profile with test-selected dialog paths",
      "library navigation",
      "select and restore earlier recipe through UI, keeping newer version",
      "history keyboard focus and A/AA accessibility",
      "archive, reload, unarchive through real IPC and persisted store",
      "history and archived library fit 390px window",
    ],
    disclaimer:
      "One local launch, not a controlled cold-start benchmark. Navigation includes automation overhead.",
  };
  await fs.writeFile(
    "docs/performance-local.json",
    JSON.stringify(report, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
}
