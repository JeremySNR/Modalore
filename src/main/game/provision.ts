import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

export const LUANTI_ENGINE_URL =
  "https://github.com/luanti-org/luanti/releases/download/5.18.0/luanti-5.18.0-win64.zip";
export const LUANTI_ENGINE_SHA256 =
  "bebce52b58555d8208bf16767d0717788479fef23c35ec8d7bf287774d641835";
export const LUANTI_GAME_URL =
  "https://github.com/luanti-org/minetest_game/archive/9e895af6e9feb98332fa1a778001442f5669bc20.zip";
export const LUANTI_GAME_SHA256 =
  "aaeddbcc896bd9ac13cd6e6d10afb0c572a865ee1612318536e5272bef22b274";
const ENGINE_PREFIX = "luanti-5.18.0-win64";
const GAME_PREFIX = "minetest_game-9e895af6e9feb98332fa1a778001442f5669bc20";
const receipt = {
  engine: LUANTI_ENGINE_SHA256,
  game: LUANTI_GAME_SHA256,
  version: 1,
};
const LIMIT = 32 * 1024 * 1024;
const allowedHosts = new Set([
  "github.com",
  "codeload.github.com",
  "release-assets.githubusercontent.com",
]);
const aborted = () => new Error("Luanti setup was cancelled or timed out.");

async function download(
  url: string,
  file: string,
  expected: string,
  signal: AbortSignal,
  progress: (s: string) => void,
  label: string,
) {
  let next = url;
  let response: Response | undefined;
  for (let i = 0; i < 6; i++) {
    const u = new URL(next);
    if (
      u.protocol !== "https:" ||
      !allowedHosts.has(u.hostname) ||
      u.username ||
      u.password ||
      (u.port && u.port !== "443")
    )
      throw new Error("Unexpected download redirect");
    response = await fetch(u, { redirect: "manual", signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Invalid download redirect");
      next = new URL(location, u).href;
      continue;
    }
    break;
  }
  if (!response?.ok || !response.body) {
    await response?.body?.cancel();
    throw new Error("Could not download Luanti setup files");
  }
  const length = Number(response.headers.get("content-length"));
  if (length > LIMIT) {
    await response.body.cancel();
    throw new Error("Download exceeds size limit");
  }
  const hash = createHash("sha256");
  let bytes = 0,
    lastMiB = -1;
  const stream = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream,
  );
  stream.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    hash.update(chunk);
    if (bytes > LIMIT) stream.destroy(new Error("Download exceeds size limit"));
    else if (Math.floor(bytes / 1048576) > lastMiB) {
      lastMiB = Math.floor(bytes / 1048576);
      progress(`${label}: downloaded ${(bytes / 1048576).toFixed(1)} MiB`);
    }
  });
  await pipeline(stream, createWriteStream(file, { flags: "wx" }), { signal });
  progress(`${label}: downloaded ${(bytes / 1048576).toFixed(1)} MiB`);
  if (hash.digest("hex") !== expected)
    throw new Error("Download failed checksum verification");
}

function safeComponents(name: string, prefix: string): string[] {
  if (
    name.includes("\\") ||
    name.startsWith("/") ||
    !name.startsWith(prefix + "/")
  )
    throw new Error("Unsafe archive path");
  const parts = name.slice(prefix.length + 1).split("/");
  if (parts.at(-1) === "") parts.pop();
  for (const part of parts)
    if (
      !part ||
      part === "." ||
      part === ".." ||
      /[:<>"|?*\x00-\x1f]/.test(part) ||
      /[. ]$/.test(part) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
    )
      throw new Error("Unsafe archive path");
  return parts;
}
type Budget = { entries: number; bytes: number; paths: Set<string> };
/** Extracts into a fresh owned directory. Caller must verify the archive checksum first. */
export async function extractVerifiedArchive(
  archive: string,
  target: string,
  prefix: string,
  signal: AbortSignal,
  budget: Budget = { entries: 0, bytes: 0, paths: new Set() },
) {
  if (signal.aborted) throw aborted();
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(
      archive,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (e, z) =>
        e || !z ? reject(e ?? new Error("Invalid archive")) : resolve(z),
    ),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      let done = false,
        active = false;
      let activeInput: NodeJS.ReadableStream | undefined;
      let zipError: unknown;
      const fail = (e: unknown) => {
        if (!done) {
          done = true;
          signal.removeEventListener("abort", cancel);
          zip.close();
          reject(e);
        }
      };
      const cancel = () => {
        if (!active) fail(aborted());
      };
      signal.addEventListener("abort", cancel, { once: true });
      zip.on("error", (e) => {
        if (!active) fail(e);
        else {
          zipError = e;
          if (activeInput && "destroy" in activeInput)
            (activeInput as import("node:stream").Readable).destroy(e);
        }
      });
      zip.on("end", () => {
        if (!done) {
          done = true;
          signal.removeEventListener("abort", cancel);
          resolve();
        }
      });
      zip.on("entry", (entry) => {
        active = true;
        void (async () => {
          if (signal.aborted) throw aborted();
          if (zipError) throw zipError;
          if (
            ++budget.entries > 20000 ||
            (budget.bytes += entry.uncompressedSize) > 250 * 1024 * 1024
          )
            throw new Error("Archive exceeds extraction limit");
          const parts = safeComponents(entry.fileName, prefix);
          const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
          if (mode && mode !== 0x8000 && mode !== 0x4000)
            throw new Error("Archive links or special files are not allowed");
          if (!parts.length) {
            active = false;
            zip.readEntry();
            return;
          }
          const dest = path.join(target, ...parts);
          const isDir = entry.fileName.endsWith("/");
          const key = path.resolve(dest).toLowerCase();
          if (budget.paths.has(key)) throw new Error("Duplicate archive path");
          budget.paths.add(key);
          if (isDir) await fs.mkdir(dest, { recursive: true });
          else {
            await fs.mkdir(path.dirname(dest), { recursive: true });
            const input = await new Promise<NodeJS.ReadableStream>((res, rej) =>
              zip.openReadStream(entry, (e, s) =>
                e || !s ? rej(e ?? new Error("Invalid archive entry")) : res(s),
              ),
            );
            activeInput = input;
            if (zipError) {
              (input as import("node:stream").Readable).destroy();
              throw zipError;
            }
            await pipeline(input, createWriteStream(dest, { flags: "wx" }), {
              signal,
            });
          }
          activeInput = undefined;
          active = false;
          if (zipError) throw zipError;
          if (signal.aborted) throw aborted();
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}
async function realDirectory(p: string) {
  const s = await fs.lstat(p);
  if (!s.isDirectory() || s.isSymbolicLink())
    throw new Error("Setup directory must be a real directory");
}
async function validInstallation(root: string) {
  try {
    await realDirectory(root);
    for (const dir of [
      "bin",
      "games",
      "games/minetest_game",
      "games/minetest_game/mods",
      "games/minetest_game/mods/player_api",
    ])
      await realDirectory(path.join(root, dir));
    const receiptStat = await fs.lstat(
      path.join(root, ".modalore-receipt.json"),
    );
    if (
      !receiptStat.isFile() ||
      receiptStat.isSymbolicLink() ||
      receiptStat.size > 1024
    )
      return false;
    const r = JSON.parse(
      await fs.readFile(path.join(root, ".modalore-receipt.json"), "utf8"),
    );
    if (JSON.stringify(r) !== JSON.stringify(receipt)) return false;
    for (const relative of [
      "bin/luanti.exe",
      "games/minetest_game/game.conf",
      "games/minetest_game/mods/player_api/init.lua",
    ]) {
      const s = await fs.lstat(path.join(root, relative));
      if (!s.isFile() || s.isSymbolicLink() || !s.size) return false;
    }
    return /^\s*title\s*=\s*Minetest Game\s*$/m.test(
      await fs.readFile(
        path.join(root, "games/minetest_game/game.conf"),
        "utf8",
      ),
    );
  } catch {
    return false;
  }
}
export async function setupLuantiRuntime(
  workshopRoot: string,
  options: {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
  } = {},
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, 5 * 60 * 1000);
  let stage: string | undefined;
  try {
    if (controller.signal.aborted) throw aborted();
    const root = path.resolve(workshopRoot);
    await fs.mkdir(root, { recursive: true });
    await realDirectory(root);
    const runtimes = path.join(root, "runtimes");
    await fs.mkdir(runtimes, { recursive: true });
    await realDirectory(runtimes);
    const final = path.join(runtimes, "luanti-5.18.0");
    if (await fs.lstat(final).catch(() => null)) {
      if (await validInstallation(final)) return final;
      throw new Error(
        "Existing runtime is not a verified Modalore installation; it was left untouched.",
      );
    }
    stage = path.join(runtimes, `.luanti-setup-${randomUUID()}`);
    await fs.mkdir(stage);
    const runtime = path.join(stage, "runtime");
    await fs.mkdir(runtime);
    const engineZip = path.join(stage, "engine.zip"),
      gameZip = path.join(stage, "game.zip");
    const progress = options.onProgress ?? (() => {});
    progress("Downloading Luanti…");
    await download(
      LUANTI_ENGINE_URL,
      engineZip,
      LUANTI_ENGINE_SHA256,
      controller.signal,
      progress,
      "Luanti",
    );
    progress("Downloading Minetest Game…");
    await download(
      LUANTI_GAME_URL,
      gameZip,
      LUANTI_GAME_SHA256,
      controller.signal,
      progress,
      "Minetest Game",
    );
    progress("Preparing portable game…");
    const budget: Budget = { entries: 0, bytes: 0, paths: new Set() };
    await extractVerifiedArchive(
      engineZip,
      runtime,
      ENGINE_PREFIX,
      controller.signal,
      budget,
    );
    const game = path.join(runtime, "games", "minetest_game");
    await fs.mkdir(game, { recursive: true });
    await extractVerifiedArchive(
      gameZip,
      game,
      GAME_PREFIX,
      controller.signal,
      budget,
    );
    await fs.writeFile(
      path.join(runtime, ".modalore-receipt.json"),
      JSON.stringify(receipt),
      { flag: "wx" },
    );
    if (!(await validInstallation(runtime)))
      throw new Error("Downloaded runtime is incomplete");
    if (controller.signal.aborted) throw aborted();
    await fs.rename(runtime, final);
    progress("Portable game ready.");
    return final;
  } catch (e) {
    if (controller.signal.aborted) throw aborted();
    throw e;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
    if (stage) await fs.rm(stage, { recursive: true, force: true });
  }
}
