import { createHash, randomInt, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createSocket } from "node:dgram";
import { promises as fs } from "node:fs";
import path from "node:path";
import { validateLuantiRecipe } from "../../shared/recipe.js";
import {
  profilePath,
  assertDirectory,
  acquireLock,
  releaseLock,
  atomicWrite,
  recoverInternal,
  snapshotLocked,
  readProfile,
} from "./adapter.js";

const templateHash =
  "0518c5ef0bb8f48c42477f252a8ff609629527c77bec8577ef311e7a3564d891";
const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const abortError = () =>
  Object.assign(new Error("Launch canceled"), { name: "AbortError" });
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

export async function generateLuantiSource(
  templatePath: string,
  value: unknown,
  sessionId = 0,
) {
  const recipe = validateLuantiRecipe(value);
  if (!Number.isSafeInteger(sessionId) || sessionId < 0)
    throw new Error("Invalid Luanti session ID");
  const template = (await fs.readFile(templatePath, "utf8")).replace(
    /\r\n/g,
    "\n",
  );
  if (hash(template) !== templateHash)
    throw new Error("Luanti runtime template failed integrity check");
  let source = template;
  for (const [marker, n] of [
    ["__SPEED__", recipe.speedMultiplier],
    ["__JUMP__", recipe.jumpMultiplier],
    ["__GRAVITY__", recipe.gravityMultiplier],
    ["__SESSION__", sessionId],
  ] as const) {
    if (source.split(marker).length !== 2)
      throw new Error("Invalid Luanti runtime template");
    source = source.replace(marker, String(n));
  }
  return source;
}

async function getVersion(exe: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ["--version"], {
      shell: false,
      windowsHide: true,
      cwd: path.dirname(exe),
    });
    let output = "";
    child.stdout.on("data", (b: Buffer) => {
      output = (output + b.toString()).slice(0, 4096);
    });
    child.stderr.on("data", (b: Buffer) => {
      output = (output + b.toString()).slice(0, 4096);
    });
    const timer = setTimeout(() => child.kill(), 5000);
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const match = output.match(
        /(?:Luanti|Minetest)\s+([0-9]+\.[0-9]+\.[0-9]+)/i,
      );
      if (code !== 0 || !match)
        reject(new Error("Unable to verify Luanti version"));
      else resolve(match[1]);
    });
  });
}

async function inspectInstallation(root: string) {
  await assertDirectory(root);
  const bin = path.join(root, "bin");
  await assertDirectory(bin);
  const exe = path.join(bin, "luanti.exe");
  const executable = await fs.lstat(exe);
  if (!executable.isFile() || executable.isSymbolicLink())
    throw new Error("Luanti executable is missing");
  const games = path.join(root, "games");
  await assertDirectory(games);
  const candidates = (await fs.readdir(games, { withFileTypes: true })).filter(
    (e) =>
      e.isDirectory() &&
      !e.isSymbolicLink() &&
      /^minetest_game(?:-[a-f0-9]{40})?$/.test(e.name),
  );
  let gameId: string | undefined;
  for (const candidate of candidates) {
    const game = path.join(games, candidate.name);
    const conf = path.join(game, "game.conf");
    const stat = await fs.lstat(conf).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 16384) continue;
    const content = await fs.readFile(conf, "utf8");
    if (!/^\s*title\s*=\s*Minetest Game\s*$/m.test(content)) continue;
    if (
      !(
        await fs
          .stat(path.join(game, "mods", "player_api", "init.lua"))
          .catch(() => null)
      )?.isFile()
    )
      continue;
    // Luanti's legacy folder convention maps minetest_game to game ID minetest.
    // Commit-suffixed source folders keep their complete name.
    gameId = candidate.name === "minetest_game" ? "minetest" : candidate.name;
    break;
  }
  if (!gameId)
    throw new Error("Minetest Game was not found in this Luanti installation");
  const version = await getVersion(exe);
  if (version !== "5.18.0")
    throw new Error(
      `Unsupported Luanti version ${version}; this adapter currently supports 5.18.0`,
    );
  return { root, exe, gameId, version };
}

export async function detectLuanti(
  candidates: string[] = process.env.MODALORE_LUANTI_DIR
    ? [process.env.MODALORE_LUANTI_DIR]
    : [],
) {
  let message = "Luanti 5.18.0 with Minetest Game was not found";
  for (const candidate of candidates) {
    try {
      const found = await inspectInstallation(path.resolve(candidate));
      return {
        found: true,
        path: found.root,
        gameId: found.gameId,
        version: found.version,
        message: "Luanti and Minetest Game detected",
      };
    } catch (e) {
      message = e instanceof Error ? e.message : message;
    }
  }
  return { found: false, message };
}

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  await assertDirectory(dir);
}
async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    socket.once("error", reject);
    socket.bind(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}
async function readOptional(file: string) {
  const stat = await fs.lstat(file).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
    throw new Error("Invalid isolated world file");
  return fs.readFile(file, "utf8");
}

export async function launchLuanti(
  root: string,
  id: string,
  installationRoot: string,
  runtimeTemplateDir: string,
  options: { signal?: AbortSignal } = {},
) {
  checkAbort(options.signal);
  const p = await profilePath(root, id);
  const lock = await acquireLock(p);
  let rollback: (() => Promise<void>) | undefined;
  try {
    await recoverInternal(p);
    const profile = await readProfile(root, id);
    const recipe = validateLuantiRecipe(profile.recipe);
    const installation = await inspectInstallation(
      path.resolve(installationRoot),
    );
    const sessionId = randomInt(1, 2 ** 48);
    const source = await generateLuantiSource(
      path.join(runtimeTemplateDir, "init.lua"),
      recipe,
      sessionId,
    );
    checkAbort(options.signal);
    const snapshotId = await snapshotLocked(root, id);
    await atomicWrite(
      path.join(p, "latest-checkpoint.json"),
      JSON.stringify({ id: snapshotId }),
    );
    await assertDirectory(path.join(p, "saves"));
    const worlds = path.join(p, "saves", "Worlds"),
      world = path.join(worlds, "luanti");
    await ensureDirectory(worlds);
    await ensureDirectory(world);
    const mods = path.join(world, "worldmods"),
      mod = path.join(mods, "modalore_rules");
    await ensureDirectory(mods);
    await ensureDirectory(mod);
    const files: [string, string][] = [
      [
        path.join(world, "world.mt"),
        `gameid = ${installation.gameId}\nbackend = sqlite3\nplayer_backend = sqlite3\nauth_backend = sqlite3\nmod_storage_backend = sqlite3\n`,
      ],
      [
        path.join(mod, "mod.conf"),
        "name = modalore_rules\ndepends = player_api\n",
      ],
      [path.join(mod, "init.lua"), source],
    ];
    const previous = await Promise.all(
      files.map(([file]) => readOptional(file)),
    );
    const oldWorld = previous[0];
    if (
      oldWorld &&
      !new RegExp(`^gameid\\s*=\\s*${installation.gameId}\\s*$`, "m").test(
        oldWorld,
      )
    )
      throw new Error("The isolated world belongs to a different game");
    // Keep existing world metadata; Luanti may have added its own settings.
    if (oldWorld) files[0][1] = oldWorld;
    rollback = async () => {
      for (let i = 0; i < files.length; i++) {
        if (previous[i] === null) await fs.rm(files[i][0], { force: true });
        else await atomicWrite(files[i][0], previous[i]!);
      }
    };
    for (const [file, content] of files) {
      checkAbort(options.signal);
      await atomicWrite(file, content);
    }
    if (hash(await fs.readFile(path.join(mod, "init.lua"))) !== hash(source))
      throw new Error("Generated Luanti source failed integrity check");
    const reportPath = path.join(world, "modalore-physics.json");
    await readOptional(reportPath);
    await fs.rm(reportPath, { force: true });
    const config = path.join(p, "luanti.conf"),
      logPath = path.join(p, `luanti-${randomUUID()}.log`);
    await atomicWrite(
      config,
      "enable_server = false\nserver_announce = false\nbind_address = 127.0.0.1\nenable_ipv6 = false\nenable_sound = false\nenable_damage = true\nfullscreen = false\nscreen_w = 960\nscreen_h = 640\nsecure.enable_security = true\n",
    );
    const port = await availablePort();
    checkAbort(options.signal);
    const child = spawn(
      installation.exe,
      [
        "--go",
        "--world",
        world,
        "--gameid",
        installation.gameId,
        "--config",
        config,
        "--logfile",
        logPath,
        "--port",
        String(port),
      ],
      {
        cwd: path.dirname(installation.exe),
        shell: false,
        windowsHide: false,
        stdio: "ignore",
      },
    );
    let closed = false,
      committed = false;
    let resolveClosed!: () => void;
    const closedPromise = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const finish = () => {
      void releaseLock(p, lock.token).catch(() => {});
    };
    const cancelChild = () => child.kill();
    options.signal?.addEventListener("abort", cancelChild, { once: true });
    // A later kill or process-management error can be emitted after the
    // initial spawn promise has settled; it must not crash the host process.
    child.on("error", () => {});
    child.once("close", () => {
      options.signal?.removeEventListener("abort", cancelChild);
      closed = true;
      if (committed) finish();
      resolveClosed();
    });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    if (options.signal?.aborted) {
      child.kill();
      await closedPromise;
      throw abortError();
    }
    if (closed) throw new Error("Luanti exited during launch");
    try {
      await atomicWrite(
        path.join(p, "profile.lock"),
        JSON.stringify({ pid: child.pid, token: lock.token }),
      );
    } catch (e) {
      child.kill();
      await closedPromise;
      throw e;
    }
    if (options.signal?.aborted) {
      child.kill();
      await closedPromise;
      throw abortError();
    }
    if (closed) throw new Error("Luanti exited during launch");
    rollback = undefined;
    committed = true;
    if (closed) finish();
    return {
      snapshotId,
      pid: child.pid,
      logPath,
      reportPath,
      sessionId,
      sourceHash: hash(source),
      evidence: {
        schema: true,
        build: false,
        launch: "process-started",
        gameplay: false,
      },
      warning:
        "Physics readback is written after a player joins; movement is not observed. Single-player only.",
    };
  } catch (e) {
    if (rollback)
      try {
        await rollback();
      } catch {
        await releaseLock(p, lock.token);
        throw new Error(
          "Launch failed and isolated mod rollback was incomplete",
        );
      }
    await releaseLock(p, lock.token);
    throw e;
  }
}

/** Readback is evidence of an API value, not proof of physical movement. */
export async function readLuantiReport(
  root: string,
  id: string,
  sessionId: number,
) {
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0)
    throw new Error("Invalid Luanti session ID");
  const p = await profilePath(root, id);
  const recipe = validateLuantiRecipe((await readProfile(root, id)).recipe);
  for (const dir of [
    path.join(p, "saves"),
    path.join(p, "saves", "Worlds"),
    path.join(p, "saves", "Worlds", "luanti"),
  ])
    await assertDirectory(dir);
  const file = path.join(
    p,
    "saves",
    "Worlds",
    "luanti",
    "modalore-physics.json",
  );
  const bytes = await readOptional(file);
  if (bytes === null) return null;
  const report = JSON.parse(bytes) as Record<string, unknown>;
  const requested = report.requested as Record<string, unknown> | undefined;
  const observed = report.observed as Record<string, unknown> | undefined;
  if (
    !requested ||
    !observed ||
    typeof requested !== "object" ||
    typeof observed !== "object"
  )
    throw new Error("Invalid Luanti physics report");
  for (const [key, expected] of [
    ["speed", recipe.speedMultiplier],
    ["jump", recipe.jumpMultiplier],
    ["gravity", recipe.gravityMultiplier],
  ] as const) {
    if (
      requested[key] !== expected ||
      typeof observed[key] !== "number" ||
      !Number.isFinite(observed[key])
    )
      throw new Error("Luanti report does not match the current recipe");
  }
  const matches = (["speed", "jump", "gravity"] as const).every(
    (key) =>
      Math.abs((requested[key] as number) - (observed[key] as number)) < 0.001,
  );
  const engine = report.engine as Record<string, unknown> | undefined;
  const game = report.game as Record<string, unknown> | undefined;
  if (
    report.session !== sessionId ||
    report.matches !== matches ||
    !engine ||
    engine.string !== "5.18.0" ||
    !game ||
    game.title !== "Minetest Game" ||
    typeof game.id !== "string" ||
    !/^(?:minetest|minetest_game(?:-[a-f0-9]{40})?)$/.test(game.id)
  )
    throw new Error("Invalid or stale Luanti physics report");
  return {
    requested,
    observed,
    matches,
    engine: report.engine,
    game: report.game,
    evidence:
      "Connected player physics override readback; movement was not observed",
  };
}
