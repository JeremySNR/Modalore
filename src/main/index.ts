import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  session,
  protocol,
  net,
} from "electron";
import { promises as fs, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { CodexClient, artifactPrompt, redact } from "./codex/index.js";
import { ProjectStore } from "./store.js";
import { validateWorkshopRecipe as validateRecipe } from "../shared/recipe.js";
import * as game from "./game/adapter.js";
import * as luanti from "./game/luanti.js";
import { setupLuantiRuntime } from "./game/provision.js";
import type { Progress, Snapshot } from "../renderer/api.js";

// Keep explicit test/custom data roots independent, including Electron's cache
// and single-instance lock, so verification never attaches to a user's session.
if (process.env.MODALORE_DATA_DIR) {
  const desktopData = path.resolve(process.env.MODALORE_DATA_DIR, ".desktop");
  mkdirSync(desktopData, { recursive: true });
  app.setPath("userData", desktopData);
  app.setPath("sessionData", desktopData);
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "modalore",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
let window: BrowserWindow;
let store: ProjectStore;
const codex = new CodexClient();
let gameState: Snapshot["game"] = {
  found: false,
  message: "Check for Terraria and tModLoader to get started.",
};
let luantiState: Snapshot["luanti"] = {
  found: false,
  message: "Set up the free game to start playing.",
};
let settings: { gameDirectory?: string; luantiDirectory?: string } = {};
async function saveSettings(change: Partial<typeof settings>) {
  const next = { ...settings, ...change };
  await game.atomicWrite(
    path.join(store.root, "settings.json"),
    JSON.stringify(next),
  );
  settings = next;
}
async function detectLuanti() {
  luantiState = await luanti.detectLuanti([
    ...(settings.luantiDirectory ? [settings.luantiDirectory] : []),
    ...(process.env.MODALORE_LUANTI_DIR
      ? [process.env.MODALORE_LUANTI_DIR]
      : []),
    path.join(store.root, "runtimes", "luanti-5.18.0"),
  ]);
  return luantiState;
}
let codexState: Snapshot["codex"] = {
  available: false,
  signedIn: false,
  message: "Connect when you want to create with AI.",
};
let active: AbortController | undefined;
let mutating = false;
const send = (progress: Progress) => {
  if (!window.isDestroyed())
    window.webContents.send("modalore:progress", progress);
};
const runtimeDirectory = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "runtime", "ModaloreRules")
    : path.join(app.getAppPath(), "runtime", "ModaloreRules");
const plainRecipe = validateRecipe;
async function detect() {
  const detected = await game.detectGame();
  const location = detected.locations.find((l) => l.tModLoader);
  if (location) {
    const dir = path.join(location.root, "steamapps", "common", "tModLoader");
    const found = await fs
      .stat(path.join(dir, "tModLoader.dll"))
      .then((s) => s.isFile())
      .catch(() => false);
    gameState = {
      found,
      path: found ? dir : undefined,
      message: found
        ? "tModLoader found. Gameplay compatibility has not been verified."
        : "Steam lists tModLoader, but its files are missing. Repair it in Steam.",
    };
  } else
    gameState = {
      found: false,
      message:
        "Install Terraria and tModLoader in Steam, then check again or choose the tModLoader folder.",
    };
  return gameState;
}
function handle(
  name: string,
  handler: (...args: any[]) => unknown,
  mutation = false,
) {
  ipcMain.handle(`modalore:${name}`, async (event, ...args) => {
    const url = event.senderFrame?.url;
    const trusted = app.isPackaged
      ? url?.startsWith("modalore://app/")
      : url?.startsWith("modalore://app/") ||
        url?.startsWith("http://127.0.0.1:5173/");
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trusted
    )
      throw new Error("Untrusted application request");
    if (mutation && mutating)
      throw new Error(
        "Let the current operation finish, or stop the Codex task first.",
      );
    if (mutation) mutating = true;
    try {
      return await handler(...args);
    } catch (error) {
      throw new Error(
        redact(
          error instanceof Error
            ? error.message
            : "The operation did not complete.",
        ),
      );
    } finally {
      if (mutation) mutating = false;
    }
  });
}
function registerHandlers() {
  handle("snapshot", async () => {
    const projects = await store.list();
    return {
      game: gameState,
      luanti: luantiState,
      codex: codexState,
      projects: projects.filter((p) => !p.archivedAt),
      archivedProjects: projects.filter((p) => p.archivedAt),
    };
  });
  handle("detectLuanti", detectLuanti);
  handle(
    "pickLuanti",
    async () => {
      const selected = await dialog.showOpenDialog(window, {
        title: "Choose your Luanti folder (contains bin and games)",
        properties: ["openDirectory"],
      });
      if (selected.canceled) return luantiState;
      const found = await luanti.detectLuanti([selected.filePaths[0]]);
      if (!found.found || !found.path) throw new Error(found.message);
      await saveSettings({ luantiDirectory: found.path });
      luantiState = found;
      return found;
    },
    true,
  );
  handle(
    "setupLuanti",
    async () => {
      active = new AbortController();
      try {
        const directory = await setupLuantiRuntime(store.root, {
          signal: active.signal,
          onProgress: (message: string) =>
            send({ stage: "setup", message, status: "running" }),
        });
        const found = await luanti.detectLuanti([directory]);
        if (!found.found) throw new Error(found.message);
        await saveSettings({ luantiDirectory: directory });
        luantiState = found;
        send({
          stage: "setup",
          message:
            "The free game is ready. Open a Minetest Game recipe and choose Play.",
          status: "complete",
        });
        return found;
      } catch (error) {
        send({
          stage: "setup",
          message: active.signal.aborted
            ? "Game setup stopped. Existing projects are unchanged."
            : redact((error as Error).message),
          status: active.signal.aborted ? "cancelled" : "error",
        });
        throw error;
      } finally {
        active = undefined;
      }
    },
    true,
  );
  handle("detectGame", detect);
  handle("pickGame", async () => {
    const selected = await dialog.showOpenDialog(window, {
      title: "Choose your tModLoader folder",
      properties: ["openDirectory"],
    });
    if (selected.canceled) return gameState;
    const dir = selected.filePaths[0];
    const exists = await fs
      .stat(path.join(dir, "tModLoader.dll"))
      .then((s) => s.isFile())
      .catch(() => false);
    if (!exists)
      throw new Error(
        "This folder does not contain tModLoader.dll. Choose Steam → steamapps → common → tModLoader.",
      );
    gameState = {
      found: true,
      path: dir,
      message:
        "tModLoader found. Gameplay compatibility has not been verified.",
    };
    await saveSettings({ gameDirectory: dir });
    return gameState;
  });
  handle("connectCodex", async () => {
    try {
      const version = await codex.version();
      await codex.start();
      const status = await codex.getStatus();
      if (!status.signedIn) {
        const login = await codex.startLogin();
        await shell.openExternal(login.authUrl);
      }
      codexState = {
        available: true,
        signedIn: status.signedIn,
        message: status.signedIn
          ? `${version} connected. AI creation uses your account allowance.`
          : "Complete sign-in in your browser, then choose Connect again.",
      };
    } catch (error) {
      codex.close();
      codexState = {
        available: false,
        signedIn: false,
        message: `Could not connect. Install the Codex CLI, restart Modalore, then try again. ${redact((error as Error).message)}`,
      };
    }
    return codexState;
  });
  handle(
    "createProject",
    (recipe: unknown) => store.create(plainRecipe(recipe)),
    true,
  );
  handle(
    "updateProject",
    (id: string, recipe: unknown) => store.update(id, plainRecipe(recipe)),
    true,
  );
  handle(
    "restoreVersion",
    (id: string, versionId: string) => store.restoreVersion(id, versionId),
    true,
  );
  handle("archiveProject", (id: string) => store.archive(id), true);
  handle("unarchiveProject", (id: string) => store.unarchive(id), true);
  handle(
    "remix",
    async (id: string, request: unknown) => {
      if (
        typeof request !== "string" ||
        !request.trim() ||
        request.length > 4000
      )
        throw new Error("Describe your change in 1–4,000 characters.");
      const project = await store.readActive(id);
      if (!(await codex.getStatus()).signedIn)
        throw new Error(
          "Connect your Codex account in Setup before using AI creation.",
        );
      active = new AbortController();
      const workspace = path.join(store.root, "jobs", randomUUID());
      await fs.mkdir(workspace, { recursive: true });
      await fs.writeFile(
        path.join(workspace, "recipe.json"),
        JSON.stringify(project.recipe, null, 2),
      );
      send({
        stage: "create",
        message: "Codex is working on your recipe",
        status: "running",
      });
      try {
        const result = await codex.runTurn({
          workspace,
          signal: active.signal,
          timeoutMs: 180000,
          prompt: artifactPrompt(
            `Edit recipe.json. Supported schema is exactly ${
              project.recipe.schemaVersion === 2
                ? '{schemaVersion:2,game:"luanti-minetest-game",title:string (1–80 chars),description:string (0–500 chars),speedMultiplier:number,jumpMultiplier:number,gravityMultiplier:number}. These are the ONLY supported mechanics: player movement speed, jump impulse, and gravity.'
                : "{schemaVersion:1,title:string (1–80 chars),description:string (0–500 chars),damageMultiplier:number,enemyHealthMultiplier:number,coinMultiplier:number}. These are the ONLY supported mechanics: player damage, enemy health, and enemy coin rewards."
            } All three multipliers must be finite between 0.5 and 3. No additional fields or change of game/schema. If the request needs any unsupported mechanic, do not pretend to implement it: leave the recipe unchanged and explain the limitation. Preserve unspecified fields. The user's change request follows:\n${request}`,
            "recipe.json",
          ),
          onProgress: (p) =>
            send({
              stage: "create",
              message: "Codex is working on your recipe",
              detail: `${p.method}${p.message ? ` · ${p.message}` : ""}`,
              status: "running",
            }),
          onApproval: async (approval) => {
            if (active?.signal.aborted) return "decline";
            const details = [
              approval.reason,
              approval.command && `Command: ${approval.command}`,
              approval.cwd && `Folder: ${approval.cwd}`,
              approval.grantRoot &&
                `Requested write access: ${approval.grantRoot}`,
              ...approval.paths.map((p) => `File: ${p}`),
            ]
              .filter(Boolean)
              .join("\n");
            const result = await dialog.showMessageBox(window, {
              type: "warning",
              title: "Codex needs your permission",
              message:
                approval.kind === "fileChange"
                  ? "Allow Codex to change these files?"
                  : "Allow Codex to run this command?",
              detail: `${redact(details).slice(0, 7000)}\n\nOnly approve actions you understand. Declining keeps your saved recipe unchanged.`,
              buttons: ["Decline", "Allow once"],
              defaultId: 0,
              cancelId: 0,
            });
            return !active?.signal.aborted && result.response === 1
              ? "accept"
              : "decline";
          },
        });
        if (active.signal.aborted || result.status === "interrupted")
          throw new Error(
            "Creation stopped. Your previous version is unchanged.",
          );
        if (result.status !== "completed") {
          const reasons: Record<string, string> = {
            usageLimitExceeded:
              "Your Codex usage allowance is exhausted. Check your account and try again when it resets.",
            rateLimitExceeded:
              "Codex is receiving too many requests. Wait a little and retry.",
            unauthorized:
              "Your Codex session needs attention. Reconnect in Setup.",
            sandboxError:
              "Codex could not use its sandbox. Check your Codex installation and Windows setup.",
          };
          throw new Error(
            `${reasons[result.errorCode ?? ""] ?? "Codex could not finish."} Your previous version is unchanged.`,
          );
        }
        send({
          stage: "validate",
          message: "Checking the recipe and its supported changes",
          status: "running",
        });
        const file = path.join(workspace, "recipe.json"),
          stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384)
          throw new Error(
            "Codex produced an invalid artifact. Your previous version is unchanged.",
          );
        const recipe = validateRecipe(
          JSON.parse(await fs.readFile(file, "utf8")),
        );
        if (JSON.stringify(recipe) === JSON.stringify(project.recipe))
          throw new Error(
            result.message.slice(0, 1200) ||
              (project.recipe.schemaVersion === 2
                ? "The recipe did not change. Try changing movement speed, jump or gravity."
                : "The recipe did not change. Try changing damage, enemy health, or coin rewards."),
          );
        if (active.signal.aborted)
          throw new Error(
            "Creation stopped. Your previous version is unchanged.",
          );
        const updated = await store.update(id, recipe);
        send({
          stage: "saved",
          message: "Your new recipe is saved",
          detail: "Schema checked. Building and gameplay are separate checks.",
          status: "complete",
        });
        return updated;
      } catch (error) {
        send({
          stage: "stopped",
          message: active.signal.aborted
            ? "Creation stopped. Your previous version is unchanged."
            : redact((error as Error).message),
          status: active.signal.aborted ? "cancelled" : "error",
        });
        throw error;
      } finally {
        active = undefined;
      }
    },
    true,
  );
  handle("cancel", () => {
    active?.abort();
  });
  handle("exportProject", async (id: string) => {
    const project = await store.readActive(id);
    const selected = await dialog.showSaveDialog(window, {
      title: "Export this exact recipe version",
      defaultPath: `${project.name.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 60) || "creation"}.modalore.json`,
      filters: [{ name: "Modalore recipe", extensions: ["json"] }],
    });
    if (selected.canceled || !selected.filePath)
      return { message: "Export cancelled." };
    await fs.writeFile(
      selected.filePath,
      game.exportPackage(project.recipe, project.parentHash),
    );
    return {
      message:
        "Recipe exported. Send this file to a friend; it contains no game files or saves.",
    };
  });
  handle(
    "importProject",
    async () => {
      const selected = await dialog.showOpenDialog(window, {
        title: "Import a Modalore recipe",
        properties: ["openFile"],
        filters: [{ name: "Modalore recipe", extensions: ["json"] }],
      });
      if (selected.canceled) return null;
      const stat = await fs.stat(selected.filePaths[0]);
      if (stat.size > 65536)
        throw new Error(
          "This package is too large. Choose a Modalore recipe package under 64 KB.",
        );
      const pkg = game.importPackage(
        await fs.readFile(selected.filePaths[0], "utf8"),
      );
      // Import preserves the exact immutable package. Only a later remix creates new ancestry.
      return store.create(pkg.recipe, pkg.parentHash ?? undefined);
    },
    true,
  );
  handle(
    "play",
    async (id: string) => {
      const project = await store.readActive(id);
      if (project.recipe.schemaVersion === 2) {
        if (!luantiState?.found || !luantiState.path)
          throw new Error(
            "Open Setup and choose Set up free game before playing.",
          );
        active = new AbortController();
        send({
          stage: "launch",
          message: "Preparing your separate Minetest Game world",
          status: "running",
        });
        try {
          const template = app.isPackaged
            ? path.join(process.resourcesPath, "runtime", "luanti")
            : path.join(app.getAppPath(), "runtime", "luanti");
          const launched = await luanti.launchLuanti(
            store.root,
            id,
            luantiState.path,
            template,
            { signal: active.signal },
          );
          send({
            stage: "launch",
            message: "Waiting for your player to join the new world",
            status: "running",
          });
          let report: Awaited<ReturnType<typeof luanti.readLuantiReport>> =
            null;
          const deadline = Date.now() + 20000;
          while (!report && Date.now() < deadline && !active.signal.aborted) {
            try {
              report = await luanti.readLuantiReport(
                store.root,
                id,
                launched.sessionId,
              );
            } catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
            }
            if (!report)
              await new Promise((resolve) => setTimeout(resolve, 250));
          }
          if (active.signal.aborted)
            throw new Error(
              "Game launch stopped. Your saved recipe is unchanged.",
            );
          if (report && !report.matches)
            throw new Error(
              "The game started, but its player settings differ from this recipe. Close the game and retry.",
            );
          await store.save({
            ...project,
            checkpoint: launched.snapshotId,
            status: report
              ? "Player settings confirmed · separate world"
              : "Game process started · player settings not confirmed",
          });
          send({
            stage: "launch",
            message: report
              ? "Your player joined with the recipe's settings"
              : "Game process started; player settings not confirmed yet",
            detail: report ? report.evidence : launched.warning,
            status: "complete",
          });
          return {
            message: `${report ? "Your player joined with the requested speed, jump and gravity." : "Minetest Game started, but player settings have not been confirmed. Check its window for an error."} Use W A S D to move and Space to jump. Close the game before changing the recipe.`,
          };
        } catch (error) {
          send({
            stage: "launch",
            message: redact((error as Error).message),
            status: active.signal.aborted ? "cancelled" : "error",
          });
          throw error;
        } finally {
          active = undefined;
        }
      }
      if (!gameState?.found || !gameState.path)
        throw new Error("Open Setup and locate tModLoader before playing.");
      const consent = await dialog.showMessageBox(window, {
        type: "warning",
        title: "Try this recipe in a separate profile",
        message: "Build and launch an experimental mod?",
        detail:
          "This preview has not been gameplay-tested. It creates a separate save folder and a checkpoint before launch. Create a NEW single-player character and world in tModLoader. Do not use multiplayer or your original saves.",
        buttons: ["Cancel", "Build and try"],
        defaultId: 0,
        cancelId: 0,
      });
      if (consent.response !== 1) return { message: "Nothing changed." };
      active = new AbortController();
      send({
        stage: "build",
        message: "Building your recipe with tModLoader",
        status: "running",
      });
      try {
        const built = await game.buildRuntime(
          store.root,
          id,
          gameState.path,
          runtimeDirectory(),
          project.recipe,
          { signal: active.signal },
        );
        if (active.signal.aborted)
          throw new Error(
            "Build stopped. Your previous installed mod is unchanged.",
          );
        send({
          stage: "launch",
          message: "Starting a separate play profile",
          status: "running",
        });
        const launched = await game.launchProfile(
          store.root,
          id,
          gameState.path,
          built.stage,
          { signal: active.signal },
        );
        await store.save({
          ...project,
          checkpoint: launched.snapshotId,
          status: "Built · launch requested · gameplay unverified",
        });
        send({
          stage: "launch",
          message: "Game process started",
          detail: launched.warning,
          status: "complete",
        });
        return {
          message:
            "tModLoader started. Create a new single-player character and world in this separate profile. Gameplay is not yet verified.",
        };
      } catch (error) {
        send({
          stage: "build",
          message: redact((error as Error).message),
          status: active.signal.aborted ? "cancelled" : "error",
        });
        throw error;
      } finally {
        active = undefined;
      }
    },
    true,
  );
  handle(
    "restore",
    async (id: string) => {
      const project = await store.readActive(id);
      const answer = await dialog.showMessageBox(window, {
        type: "question",
        title: "Restore a previous version",
        message: "What would you like to restore?",
        detail:
          "Reverting a recipe keeps your saves. Restoring a save checkpoint discards progress made after that checkpoint.",
        buttons: ["Cancel", "Revert recipe", "Restore save checkpoint"],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response === 1) {
        await store.revert(id);
        return {
          message: "Previous recipe restored. Your saves are unchanged.",
        };
      }
      if (answer.response === 2) {
        const checkpoint =
          (await game.readLatestCheckpoint(store.root, id)) ??
          project.checkpoint;
        if (!checkpoint)
          throw new Error(
            "No save checkpoint exists yet. A checkpoint is created before an isolated play session.",
          );
        const confirm = await dialog.showMessageBox(window, {
          type: "warning",
          message: "Restore saves and discard later progress?",
          detail:
            "This changes only this Modalore profile. Your original game saves stay separate.",
          buttons: ["Cancel", "Restore checkpoint"],
          defaultId: 0,
          cancelId: 0,
        });
        if (confirm.response === 1) {
          await game.restoreSnapshot(store.root, id, checkpoint);
          return { message: "Profile save checkpoint restored." };
        }
      }
      return { message: "Nothing changed." };
    },
    true,
  );
  handle("openExternal", async (key: string) => {
    const links: Record<string, string> = {
      codex: "https://developers.openai.com/codex/cli/",
      tmodloader: "https://store.steampowered.com/app/1281930/tModLoader/",
      luanti: "https://www.luanti.org/",
    };
    if (!Object.hasOwn(links, key)) throw new Error("Unknown help link");
    await shell.openExternal(links[key]);
  });
}
app
  .whenReady()
  .then(async () => {
    store = new ProjectStore(
      process.env.MODALORE_DATA_DIR ||
        path.join(app.getPath("userData"), "workshop"),
    );
    await store.init();
    try {
      const savedSettings = JSON.parse(
        await fs.readFile(path.join(store.root, "settings.json"), "utf8"),
      );
      if (typeof savedSettings.gameDirectory === "string")
        settings.gameDirectory = savedSettings.gameDirectory;
      if (typeof savedSettings.luantiDirectory === "string")
        settings.luantiDirectory = savedSettings.luantiDirectory;
      if (
        typeof settings.gameDirectory === "string" &&
        (
          await fs.stat(path.join(settings.gameDirectory, "tModLoader.dll"))
        ).isFile()
      )
        gameState = {
          found: true,
          path: settings.gameDirectory,
          message: "Your selected tModLoader folder.",
        };
    } catch {
      await detect();
    }
    await detectLuanti();
    protocol.handle("modalore", (request) => {
      const url = new URL(request.url);
      if (url.host !== "app") return new Response("Not found", { status: 404 });
      const root = path.join(app.getAppPath(), "dist", "renderer");
      const file = path.resolve(
        root,
        `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
      );
      if (!file.startsWith(`${root}${path.sep}`))
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    window = new BrowserWindow({
      width: 1440,
      height: 980,
      minWidth: 560,
      minHeight: 620,
      backgroundColor: "#191a17",
      title: "Modalore",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.on("close", (event) => {
      if (active) {
        event.preventDefault();
        void dialog
          .showMessageBox(window, {
            message: "Stop the current operation and close Modalore?",
            detail: "Your last saved version will remain available.",
            buttons: ["Keep working", "Stop and close"],
            defaultId: 0,
            cancelId: 0,
          })
          .then((answer) => {
            if (answer.response === 1) {
              active?.abort();
              codex.close();
              window.destroy();
              app.quit();
            }
          });
      }
    });
    registerHandlers();
    const dev = !app.isPackaged && process.env.MODALORE_DEV_URL;
    if (dev === "http://127.0.0.1:5173") await window.loadURL(dev);
    else await window.loadURL("modalore://app/");
  })
  .catch((error) => {
    dialog.showErrorBox("Modalore could not start", redact(String(error)));
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  active?.abort();
  codex.close();
});
