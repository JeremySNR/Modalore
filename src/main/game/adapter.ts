import { createHash, randomUUID } from "node:crypto";
import { promises as fs, createWriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  validateRecipe,
  validateWorkshopRecipe,
  type WorkshopRecipe,
} from "../../shared/recipe.js";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const canonical = (r: WorkshopRecipe) =>
  JSON.stringify(validateWorkshopRecipe(r));
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
function safeId(id: string) {
  if (!idPattern.test(id)) throw new Error("Invalid profile or snapshot ID");
  return id;
}
export async function assertDirectory(p: string) {
  const stat = await fs.lstat(p);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("Expected a real directory");
}
export async function profilePath(root: string, id: string) {
  safeId(id);
  await assertDirectory(root);
  const profiles = path.join(root, "profiles");
  await assertDirectory(profiles);
  const p = path.join(profiles, id);
  await assertDirectory(p);
  return p;
}
type ProfileLock = { pid: number; token: string };
async function readLock(p: string): Promise<ProfileLock | null> {
  const file = path.join(p, "profile.lock");
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024)
      throw new Error("Profile lock is invalid; inspect it before proceeding");
    const lock = JSON.parse(await fs.readFile(file, "utf8")) as ProfileLock;
    if (
      !Number.isSafeInteger(lock.pid) ||
      lock.pid <= 0 ||
      typeof lock.token !== "string" ||
      !/^[a-f0-9-]{36}$/.test(lock.token)
    )
      throw new Error("Invalid lock");
    return lock;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(
      "Profile lock is invalid or unreadable; inspect it before proceeding",
    );
  }
}
function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ESRCH") return false;
    return true;
  }
}
async function assertUnlocked(p: string) {
  if (runningProfiles.has(path.resolve(p)))
    throw new Error("Close the game before changing this profile");
  const lock = await readLock(p);
  if (!lock) return;
  if (processAlive(lock.pid))
    throw new Error(
      "Close the game before changing this profile (profile lock is active)",
    );
  // Remove only the exact stale lock we observed; never signal the process.
  const again = await readLock(p);
  if (again?.pid !== lock.pid || again.token !== lock.token)
    throw new Error("Profile lock changed; try again");
  await fs.rm(path.join(p, "profile.lock"));
}
export async function acquireLock(p: string) {
  await assertUnlocked(p);
  const lock = { pid: process.pid, token: randomUUID() };
  try {
    await fs.writeFile(path.join(p, "profile.lock"), JSON.stringify(lock), {
      flag: "wx",
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Profile is locked by another process");
    throw e;
  }
  return lock;
}
export async function releaseLock(p: string, token: string) {
  const lock = await readLock(p);
  if (lock?.token === token)
    await fs.rm(path.join(p, "profile.lock"), { force: true });
}
async function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (e) {
      if (
        attempt >= 4 ||
        !["EPERM", "EBUSY", "EACCES"].includes(
          (e as NodeJS.ErrnoException).code ?? "",
        )
      )
        throw e;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}
export async function atomicWrite(file: string, data: string) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, data, { flag: "wx" });
    await renameWithRetry(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
export async function recoverInternal(p: string) {
  const restoreFile = path.join(p, "restore-journal.json");
  let journal: { staging: string; backup: string } | undefined;
  try {
    const stat = await fs.lstat(restoreFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096)
      throw new Error("Invalid journal");
    journal = JSON.parse(await fs.readFile(restoreFile, "utf8"));
    if (!journal || typeof journal !== "object")
      throw new Error("Invalid journal");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Restore recovery journal is unreadable");
  }
  if (journal) {
    if (
      !/^restore-[a-f0-9-]{36}$/.test(journal.staging) ||
      !/^previous-[a-f0-9-]{36}$/.test(journal.backup)
    )
      throw new Error("Invalid restore recovery journal");
    const saves = path.join(p, "saves"),
      stage = path.join(p, journal.staging),
      backup = path.join(p, journal.backup);
    const exists = async (f: string) => !!(await fs.lstat(f).catch(() => null));
    if (!(await exists(saves))) {
      await assertDirectory(backup);
      await renameWithRetry(backup, saves);
    }
    await assertDirectory(saves);
    if (await exists(stage)) {
      await assertDirectory(stage);
      await fs.rm(stage, { recursive: true, force: true });
    }
    if (await exists(backup)) {
      await assertDirectory(backup);
      await fs.rm(backup, { recursive: true, force: true });
    }
    await fs.rm(restoreFile);
  }
  const transaction = path.join(p, "install-recovery");
  const txStat = await fs.lstat(transaction).catch(() => null);
  if (txStat) {
    await assertDirectory(transaction);
    let manifest: { hadMod: boolean; hadEnabled: boolean } | undefined;
    try {
      const manifestFile = path.join(transaction, "manifest.json"),
        stat = await fs.lstat(manifestFile);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096)
        throw new Error("Invalid journal");
      manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
      if (!manifest || typeof manifest !== "object")
        throw new Error("Invalid journal");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("Install recovery journal is unreadable");
    }
    if (manifest) {
      if (
        typeof manifest.hadMod !== "boolean" ||
        typeof manifest.hadEnabled !== "boolean"
      )
        throw new Error("Invalid install recovery journal");
      const mods = path.join(p, "saves", "Mods");
      await assertDirectory(path.join(p, "saves"));
      await assertDirectory(mods);
      for (const [target, backup, had] of [
        ["ModaloreRules.tmod", "mod.backup", manifest.hadMod],
        ["enabled.json", "enabled.backup", manifest.hadEnabled],
      ] as const) {
        const dest = path.join(mods, target);
        if (!had) {
          await fs.rm(dest, { force: true });
          continue;
        }
        const source = path.join(transaction, backup),
          stat = await fs.lstat(source);
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error("Invalid install recovery backup");
        const temp = path.join(mods, `${target}.${randomUUID()}.tmp`);
        try {
          await fs.copyFile(source, temp);
          await renameWithRetry(temp, dest);
        } finally {
          await fs.rm(temp, { force: true });
        }
      }
    }
    await fs.rm(transaction, { recursive: true, force: true });
  }
}
export async function recoverProfile(root: string, id: string) {
  const p = await profilePath(root, id);
  await assertUnlocked(p);
  await recoverInternal(p);
}
export async function readLatestCheckpoint(
  root: string,
  id: string,
): Promise<string | null> {
  const p = await profilePath(root, id);
  try {
    const data = JSON.parse(
      await fs.readFile(path.join(p, "latest-checkpoint.json"), "utf8"),
    );
    if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id))
      throw new Error("Invalid checkpoint");
    return data.id;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("Checkpoint record is invalid");
  }
}
/** Creates only Modalore-owned data; never reads or changes the player's original saves. */
export async function createProfile(root: string, id: string) {
  safeId(id);
  await fs.mkdir(root, { recursive: true });
  await assertDirectory(root);
  const profiles = path.join(root, "profiles");
  await fs.mkdir(profiles, { recursive: true });
  await assertDirectory(profiles);
  const p = path.join(profiles, id);
  await fs.mkdir(p);
  await fs.mkdir(path.join(p, "saves"));
  await fs.mkdir(path.join(p, "snapshots"));
  await fs.mkdir(path.join(p, "versions"));
  return p;
}
/** Stores a validated recipe as an immutable version; this is not a compiled game mod. */
export async function installRecipe(root: string, id: string, value: unknown) {
  const p = await profilePath(root, id);
  const recipe = validateWorkshopRecipe(value);
  const bytes = canonical(recipe);
  const hash = sha(bytes);
  await assertUnlocked(p);
  await recoverInternal(p);
  const versions = path.join(p, "versions");
  await assertDirectory(versions);
  const version = path.join(versions, `${hash}.json`);
  try {
    await fs.writeFile(version, bytes, { flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    if ((await fs.readFile(version, "utf8")) !== bytes)
      throw new Error("Version collision");
  }
  await atomicWrite(
    path.join(p, "current.json"),
    JSON.stringify({ recipeHash: hash }),
  );
  return {
    recipe,
    hash,
    evidence: { schema: true, build: false, launch: false, gameplay: false },
  };
}
export async function listVersions(root: string, id: string) {
  const p = await profilePath(root, id),
    versions = path.join(p, "versions");
  await assertDirectory(versions);
  const entries = await fs.readdir(versions, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /^[a-f0-9]{64}\.json$/.test(e.name))
    .map((e) => e.name.slice(0, -5));
}
export async function readProfile(root: string, id: string) {
  const p = await profilePath(root, id);
  let pointer: { recipeHash: string };
  try {
    pointer = JSON.parse(
      await fs.readFile(path.join(p, "current.json"), "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { recipe: null, hash: null };
    throw e;
  }
  if (
    !pointer ||
    typeof pointer.recipeHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(pointer.recipeHash)
  )
    throw new Error("Invalid profile pointer");
  const bytes = await fs.readFile(
    path.join(p, "versions", `${pointer.recipeHash}.json`),
    "utf8",
  );
  if (sha(bytes) !== pointer.recipeHash)
    throw new Error("Stored recipe failed integrity check");
  return {
    recipe: validateWorkshopRecipe(JSON.parse(bytes)),
    hash: pointer.recipeHash,
  };
}
export async function revertVersion(root: string, id: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid version hash");
  const p = await profilePath(root, id),
    versions = await listVersions(root, id);
  await assertUnlocked(p);
  await recoverInternal(p);
  if (!versions.includes(hash)) throw new Error("Version not found");
  const bytes = await fs.readFile(
    path.join(p, "versions", `${hash}.json`),
    "utf8",
  );
  if (sha(bytes) !== hash)
    throw new Error("Stored recipe failed integrity check");
  const recipe = validateWorkshopRecipe(JSON.parse(bytes));
  await atomicWrite(
    path.join(p, "current.json"),
    JSON.stringify({ recipeHash: hash }),
  );
  return { recipe, hash };
}
export function exportPackage(value: unknown, parentHash?: string): string {
  const recipe = validateWorkshopRecipe(value);
  if (parentHash && !/^[a-f0-9]{64}$/.test(parentHash))
    throw new Error("Invalid parent hash");
  const content = {
    format: "modalore-recipe" as const,
    version: recipe.schemaVersion,
    recipe,
    dependencies:
      recipe.schemaVersion === 1
        ? ["Terraria", "tModLoader", "ModaloreRules"]
        : ["Luanti", "Minetest Game", "ModaloreMovement"],
    supportedVersions:
      recipe.schemaVersion === 1
        ? "unverified"
        : "Luanti 5.18.0; Minetest Game 9e895af6e9feb98332fa1a778001442f5669bc20",
    parentHash: parentHash ?? null,
    evidence: { schema: true, build: false, launch: false, gameplay: false },
  };
  return JSON.stringify(
    { ...content, hash: sha(JSON.stringify(content)) },
    null,
    2,
  );
}
export function importPackage(json: string) {
  if (Buffer.byteLength(json, "utf8") > 64 * 1024)
    throw new Error("Package too large");
  const pkg = JSON.parse(json) as Record<string, unknown>;
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg))
    throw new Error("Invalid package");
  const keys = [
    "format",
    "version",
    "recipe",
    "dependencies",
    "supportedVersions",
    "parentHash",
    "evidence",
    "hash",
  ];
  if (
    Object.keys(pkg).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(pkg, k))
  )
    throw new Error("Unexpected package fields");
  const recipe = validateWorkshopRecipe(pkg.recipe);
  if (
    pkg.format !== "modalore-recipe" ||
    pkg.version !== recipe.schemaVersion ||
    JSON.stringify(pkg.dependencies) !==
      JSON.stringify(
        recipe.schemaVersion === 1
          ? ["Terraria", "tModLoader", "ModaloreRules"]
          : ["Luanti", "Minetest Game", "ModaloreMovement"],
      ) ||
    pkg.supportedVersions !==
      (recipe.schemaVersion === 1
        ? "unverified"
        : "Luanti 5.18.0; Minetest Game 9e895af6e9feb98332fa1a778001442f5669bc20") ||
    !(
      pkg.parentHash === null ||
      (typeof pkg.parentHash === "string" &&
        /^[a-f0-9]{64}$/.test(pkg.parentHash))
    )
  )
    throw new Error("Unsupported package");
  const content = {
    format: pkg.format,
    version: pkg.version,
    recipe,
    dependencies: pkg.dependencies,
    supportedVersions: pkg.supportedVersions,
    parentHash: pkg.parentHash,
    evidence: pkg.evidence,
  };
  if (
    JSON.stringify(pkg.evidence) !==
      JSON.stringify({
        schema: true,
        build: false,
        launch: false,
        gameplay: false,
      }) ||
    typeof pkg.hash !== "string" ||
    pkg.hash !== sha(JSON.stringify(content))
  )
    throw new Error("Package integrity check failed");
  return {
    recipe,
    hash: pkg.hash,
    parentHash: pkg.parentHash as string | null,
  };
}
/** Generate only our fixed runtime template. This produces source, not a built or tested mod. */
export async function generateRuntimeSource(
  templatePath: string,
  value: unknown,
): Promise<string> {
  const recipe = validateRecipe(value);
  const template = await fs.readFile(templatePath, "utf8");
  for (const marker of ["__DAMAGE__", "__HEALTH__", "__COINS__"])
    if (template.split(marker).length !== 2)
      throw new Error("Invalid runtime template");
  const number = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));
  return template
    .replace("__DAMAGE__", number(recipe.damageMultiplier))
    .replace("__HEALTH__", number(recipe.enemyHealthMultiplier))
    .replace("__COINS__", number(recipe.coinMultiplier));
}
async function runtimeExecutable(gameDirectory: string) {
  const dotnetRoot = path.join(gameDirectory, "dotnet");
  const exe = process.platform === "win32" ? "dotnet.exe" : "dotnet";
  const dirs = await fs
    .readdir(dotnetRoot, { withFileTypes: true })
    .catch(() => []);
  const candidates = [
    path.join(dotnetRoot, exe),
    ...dirs
      .filter((d) => d.isDirectory() && /^\d+\.\d+\.\d+$/.test(d.name))
      .sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true }),
      )
      .map((d) => path.join(dotnetRoot, d.name, exe)),
  ];
  for (const candidate of candidates)
    if ((await fs.stat(candidate).catch(() => null))?.isFile())
      return candidate;
  throw new Error("tModLoader bundled .NET runtime is missing");
}
/** Attempt a real build in a new isolated directory; never modifies the installed game or original saves. */
export async function buildRuntime(
  root: string,
  id: string,
  gameDirectory: string,
  runtimeDirectory: string,
  value: unknown,
  options: { signal?: AbortSignal } = {},
) {
  const canceled = () =>
    Object.assign(new Error("Build canceled"), { name: "AbortError" });
  if (options.signal?.aborted) throw canceled();
  const recipe = validateRecipe(value),
    p = await profilePath(root, id);
  await assertUnlocked(p);
  await recoverInternal(p);
  const dotnet = await runtimeExecutable(gameDirectory);
  const dll = path.join(gameDirectory, "tModLoader.dll");
  for (const file of [dotnet, dll]) {
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile())
      throw new Error("tModLoader runtime prerequisites are missing");
  }
  const stage = path.join(p, `build-${randomUUID()}`);
  await fs.mkdir(stage);
  const source = path.join(stage, "ModaloreRules"),
    save = path.join(stage, "save");
  await fs.mkdir(source);
  await fs.mkdir(save);
  try {
    await fs.writeFile(
      path.join(source, "ModaloreRules.cs"),
      await generateRuntimeSource(
        path.join(runtimeDirectory, "ModaloreRules.cs"),
        recipe,
      ),
    );
    for (const name of ["build.txt", "description.txt"])
      await fs.copyFile(
        path.join(runtimeDirectory, name),
        path.join(source, name),
      );
    if (options.signal?.aborted) throw canceled();
    const outcome = await new Promise<{ code: number | null; output: string }>(
      (resolve, reject) => {
        const child = spawn(
          dotnet,
          [dll, "-build", source, "-tmlsavedirectory", save],
          { cwd: gameDirectory, shell: false, windowsHide: true },
        );
        let output = "";
        const collect = (chunk: Buffer) => {
          output = (output + chunk.toString("utf8")).slice(-16000);
        };
        child.stdout.on("data", collect);
        child.stderr.on("data", collect);
        const abort = () => child.kill();
        options.signal?.addEventListener("abort", abort, { once: true });
        if (options.signal?.aborted) abort();
        const timer = setTimeout(() => child.kill(), 120000);
        const cleanup = () => {
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", abort);
        };
        child.on("error", (e) => {
          cleanup();
          reject(options.signal?.aborted ? canceled() : e);
        });
        child.on("close", (code) => {
          cleanup();
          if (options.signal?.aborted) reject(canceled());
          else resolve({ code, output });
        });
      },
    );
    if (options.signal?.aborted) throw canceled();
    const artifact = path.join(save, "Mods", "ModaloreRules.tmod");
    const stat = await fs.stat(artifact).catch(() => null);
    if (outcome.code !== 0 || !stat?.isFile() || stat.size === 0)
      throw new Error(`Build did not produce a mod (exit ${outcome.code}).`);
    await fs.writeFile(
      path.join(stage, "build.json"),
      JSON.stringify({
        recipeHash: sha(canonical(recipe)),
        artifactHash: createHash("sha256")
          .update(await fs.readFile(artifact))
          .digest("hex"),
      }),
    );
    if (options.signal?.aborted) throw canceled();
    return {
      artifact,
      stage,
      evidence: { schema: true, build: true, launch: false, gameplay: false },
      output: outcome.output,
    };
  } catch (e) {
    await fs.rm(stage, { recursive: true, force: true });
    throw e;
  }
}
async function copyTree(source: string, target: string): Promise<void> {
  await assertDirectory(source);
  await fs.mkdir(target);
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name),
      to = path.join(target, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Links are not allowed in profile saves");
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
    else throw new Error("Unsupported save entry");
  }
}
async function snapshot(root: string, id: string, internal: boolean) {
  const p = await profilePath(root, id),
    snapshots = path.join(p, "snapshots");
  await assertDirectory(snapshots);
  if (!internal) {
    await assertUnlocked(p);
    await recoverInternal(p);
  }
  const snapshotId = randomUUID();
  const target = path.join(snapshots, snapshotId);
  try {
    await assertDirectory(path.join(p, "saves"));
    await fs.mkdir(target);
    for (const name of ["Worlds", "Players"]) {
      const source = path.join(p, "saves", name);
      if (await fs.lstat(source).catch(() => null))
        await copyTree(source, path.join(target, name));
    }
  } catch (e) {
    await fs.rm(target, { recursive: true, force: true });
    throw e;
  }
  return snapshotId;
}
export async function snapshotLocked(root: string, id: string) {
  return snapshot(root, id, true);
}
export async function snapshotProfile(root: string, id: string) {
  return snapshot(root, id, false);
}
/** Explicit restore replaces profile saves and may discard progress. */
export async function restoreSnapshot(
  root: string,
  id: string,
  snapshotId: string,
) {
  safeId(snapshotId);
  const p = await profilePath(root, id),
    snapshots = path.join(p, "snapshots");
  await assertDirectory(snapshots);
  await assertUnlocked(p);
  await recoverInternal(p);
  const staging = path.join(p, `restore-${randomUUID()}`),
    backup = path.join(p, `previous-${randomUUID()}`),
    saves = path.join(p, "saves");
  await assertDirectory(saves);
  try {
    const snapshot = path.join(snapshots, snapshotId);
    await assertDirectory(snapshot);
    await copyTree(saves, staging);
    for (const name of ["Worlds", "Players"]) {
      await fs.rm(path.join(staging, name), { recursive: true, force: true });
      const source = path.join(snapshot, name);
      if (await fs.lstat(source).catch(() => null))
        await copyTree(source, path.join(staging, name));
    }
    await atomicWrite(
      path.join(p, "restore-journal.json"),
      JSON.stringify({
        staging: path.basename(staging),
        backup: path.basename(backup),
      }),
    );
    await renameWithRetry(saves, backup);
    try {
      await renameWithRetry(staging, saves);
    } catch (e) {
      await renameWithRetry(backup, saves);
      throw e;
    }
    await fs.rm(backup, { recursive: true, force: true });
    await fs.rm(path.join(p, "restore-journal.json"));
  } finally {
    if (
      !(await fs.lstat(path.join(p, "restore-journal.json")).catch(() => null))
    )
      await fs.rm(staging, { recursive: true, force: true });
  }
}
const runningProfiles = new Set<string>();
/** Installs a locally built artifact into this profile and starts the isolated game process. */
export async function launchProfile(
  root: string,
  id: string,
  gameDirectory: string,
  stage: string,
  options: { signal?: AbortSignal } = {},
) {
  const p = await profilePath(root, id),
    key = path.resolve(p);
  const lock = await acquireLock(p);
  runningProfiles.add(key);
  let rollback: (() => Promise<void>) | undefined;
  try {
    const checkCanceled = () => {
      if (options.signal?.aborted)
        throw Object.assign(new Error("Launch canceled"), {
          name: "AbortError",
        });
    };
    await recoverInternal(p);
    checkCanceled();
    const resolvedStage = path.resolve(stage),
      stageName = path.basename(resolvedStage);
    if (
      path.dirname(resolvedStage) !== path.resolve(p) ||
      !/^build-[a-f0-9-]{36}$/.test(stageName)
    )
      throw new Error("Invalid build stage");
    await assertDirectory(resolvedStage);
    const built = JSON.parse(
      await fs.readFile(path.join(resolvedStage, "build.json"), "utf8"),
    ) as { recipeHash: string; artifactHash: string };
    const current = await readProfile(root, id);
    if (!current.hash || built.recipeHash !== current.hash)
      throw new Error("Build does not match the current recipe");
    await assertDirectory(path.join(resolvedStage, "save"));
    await assertDirectory(path.join(resolvedStage, "save", "Mods"));
    const artifact = path.join(
      resolvedStage,
      "save",
      "Mods",
      "ModaloreRules.tmod",
    );
    const artifactStat = await fs.lstat(artifact);
    if (!artifactStat.isFile() || artifactStat.isSymbolicLink())
      throw new Error("Invalid build artifact");
    const bytes = await fs.readFile(artifact);
    if (
      !bytes.length ||
      createHash("sha256").update(bytes).digest("hex") !== built.artifactHash
    )
      throw new Error("Build artifact failed integrity check");
    const dotnet = await runtimeExecutable(gameDirectory),
      dll = path.join(gameDirectory, "tModLoader.dll");
    if (!(await fs.stat(dll).catch(() => null))?.isFile())
      throw new Error("tModLoader is missing");
    const save = path.join(p, "saves");
    await assertDirectory(save);
    const snapshotId = await snapshot(root, id, true);
    await atomicWrite(
      path.join(p, "latest-checkpoint.json"),
      JSON.stringify({ id: snapshotId }),
    );
    checkCanceled();
    const mods = path.join(save, "Mods");
    await fs.mkdir(mods, { recursive: true });
    await assertDirectory(mods);
    const modFile = path.join(mods, "ModaloreRules.tmod"),
      enabledFile = path.join(mods, "enabled.json");
    const readPrevious = async (file: string) => {
      try {
        const s = await fs.lstat(file);
        if (!s.isFile() || s.isSymbolicLink())
          throw new Error("Invalid existing mod file");
        return await fs.readFile(file);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    };
    const oldMod = await readPrevious(modFile),
      oldEnabled = await readPrevious(enabledFile);
    const replace = async (file: string, content: Buffer | null) => {
      if (content === null) {
        await fs.rm(file, { force: true });
        return;
      }
      const tmp = `${file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(tmp, content, { flag: "wx" });
        await renameWithRetry(tmp, file);
      } finally {
        await fs.rm(tmp, { force: true });
      }
    };
    const tx = path.join(p, "install-recovery");
    await fs.mkdir(tx);
    if (oldMod)
      await fs.writeFile(path.join(tx, "mod.backup"), oldMod, { flag: "wx" });
    if (oldEnabled)
      await fs.writeFile(path.join(tx, "enabled.backup"), oldEnabled, {
        flag: "wx",
      });
    await atomicWrite(
      path.join(tx, "manifest.json"),
      JSON.stringify({
        hadMod: oldMod !== null,
        hadEnabled: oldEnabled !== null,
      }),
    );
    rollback = async () => {
      await recoverInternal(p);
    };
    checkCanceled();
    await replace(modFile, bytes);
    checkCanceled();
    await replace(enabledFile, Buffer.from(JSON.stringify(["ModaloreRules"])));
    checkCanceled();
    const logPath = path.join(p, `launch-${randomUUID()}.log`),
      log = createWriteStream(logPath, { flags: "wx" });
    log.on("error", () => {
      /* The child lifecycle remains observable even if log writing fails. */
    });
    const child = spawn(
      dotnet,
      [
        dll,
        "-savedirectory",
        path.join(p, "vanilla"),
        "-tmlsavedirectory",
        save,
        "-steamworkshopfolder",
        "none",
      ],
      { cwd: gameDirectory, shell: false, windowsHide: true },
    );
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let closed = false,
      committed = false;
    let resolveClosed!: () => void;
    const closedPromise = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const finish = () => {
      runningProfiles.delete(key);
      void releaseLock(p, lock.token).catch(() => {});
    };
    child.once("close", (code, signal) => {
      log.end(`\nProcess exited: ${code ?? signal}\n`);
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
      checkCanceled();
    }
    try {
      await atomicWrite(
        path.join(p, "profile.lock"),
        JSON.stringify({ pid: child.pid, token: lock.token }),
      );
    } catch (e) {
      child.kill();
      throw e;
    }
    if (options.signal?.aborted) {
      child.kill();
      await closedPromise;
      checkCanceled();
    }
    try {
      await renameWithRetry(
        path.join(tx, "manifest.json"),
        path.join(tx, "committed.json"),
      );
    } catch (e) {
      child.kill();
      await closedPromise;
      throw e;
    }
    rollback = undefined;
    committed = true;
    await fs.rm(tx, { recursive: true, force: true }).catch(() => {
      /* Retained journal will recover after the game exits. */
    });
    if (closed) finish();
    return {
      pid: child.pid,
      snapshotId,
      logPath,
      evidence: {
        schema: true,
        build: true,
        launch: "process-started",
        gameplay: false,
      },
      warning:
        "Game compatibility and isolated save behavior have not been verified. Single-player only.",
    };
  } catch (e) {
    let failure = e;
    if (rollback)
      try {
        await rollback();
      } catch {
        failure = new Error(
          "Launch failed and mod rollback was incomplete; inspect the isolated profile",
        );
      }
    runningProfiles.delete(key);
    await releaseLock(p, lock.token);
    throw failure;
  }
}

export async function detectGame(
  steamRoots: string[] = process.platform === "win32"
    ? [
        path.join(
          process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
          "Steam",
        ),
      ]
    : [],
) {
  const locations: { root: string; terraria: boolean; tModLoader: boolean }[] =
    [];
  const roots = new Set(steamRoots);
  for (const root of steamRoots) {
    try {
      const vdf = await fs.readFile(
        path.join(root, "steamapps", "libraryfolders.vdf"),
        "utf8",
      );
      for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g))
        roots.add(match[1].replace(/\\\\/g, "\\"));
    } catch {
      /* Steam may not be installed. */
    }
  }
  for (const root of roots) {
    const exists = async (name: string) => {
      try {
        return (
          await fs.stat(path.join(root, "steamapps", `appmanifest_${name}.acf`))
        ).isFile();
      } catch {
        return false;
      }
    };
    locations.push({
      root,
      terraria: await exists("105600"),
      tModLoader: await exists("1281930"),
    });
  }
  return {
    locations,
    evidence: "Steam manifests only; executable and version not verified",
  };
}
