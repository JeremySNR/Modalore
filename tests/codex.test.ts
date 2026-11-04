import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  CodexClient,
  artifactPrompt,
  redact,
  resolveCodexExecutable,
} from "../src/main/codex/index";

const fake = fileURLToPath(new URL("./codex-fake-server.ts", import.meta.url));
const clientFor = (mode: string) =>
  new CodexClient("codex", () =>
    spawn(process.execPath, [fake, mode], { stdio: "pipe" }),
  );

test("artifact prompt restricts the output name", () => {
  assert.throws(() => artifactPrompt("hi", "../outside.json"));
  assert.match(artifactPrompt("make it blue", "recipe.json"), /recipe\.json/);
});

test("credentials are removed from displayed messages", () => {
  assert.doesNotMatch(
    redact("Bearer abcdef sk-secret123 eyJabc.def.ghi"),
    /abcdef|sk-secret123|eyJabc/,
  );
});

test("missing CLI reports failure and aborted tasks do not start", async () => {
  const client = new CodexClient("modalore-nonexistent-codex-command");
  await assert.rejects(client.start());
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
      signal: controller.signal,
    }),
    /cancelled/,
  );
  client.close();
});

test("protocol preserves sandbox settings and reports completion", async () => {
  const client = clientFor("normal");
  try {
    const result = await client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
    });
    assert.equal(result.status, "completed");
    assert.equal(result.message, "done");
  } finally {
    client.close();
  }
});

test("approval carries actual file paths and declines by default", async () => {
  const client = clientFor("approval");
  try {
    const denied = await client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
    });
    assert.equal(denied.message, "decline");
    const approved = await client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
      onApproval: async (approval) => {
        assert.equal(approval.kind, "fileChange");
        assert.deepEqual(approval.paths, ["recipe.json"]);
        return "accept";
      },
    });
    assert.equal(approved.message, "accept");
  } finally {
    client.close();
  }
});

test("approval from a different thread is never sent to the callback", async () => {
  const client = clientFor("wrong-thread");
  let called = false;
  try {
    const result = await client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
      onApproval: async () => {
        called = true;
        return "accept";
      },
    });
    assert.equal(result.message, "decline");
    assert.equal(called, false);
  } finally {
    client.close();
  }
});

test("failed requests redact secrets and connection loss while starting a turn is handled", async () => {
  for (const mode of ["start-error", "start-close"]) {
    const client = clientFor(mode);
    try {
      await assert.rejects(
        client.runTurn({ workspace: process.cwd(), prompt: "test" }),
        (error) =>
          error instanceof Error && !error.message.includes("sk-secret123"),
      );
    } finally {
      client.close();
    }
  }
});

test("turn failure exposes a documented limit code without raw error details", async () => {
  const client = clientFor("quota");
  try {
    const result = await client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
    });
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, "usageLimitExceeded");
    assert.doesNotMatch(JSON.stringify(result), /private details/);
  } finally {
    client.close();
  }
});

test("unexpected exit permits a fresh connection", async () => {
  let starts = 0;
  const client = new CodexClient("codex", () =>
    spawn(process.execPath, [fake, ++starts === 1 ? "exit" : "normal"], {
      stdio: "pipe",
    }),
  );
  try {
    await assert.rejects(client.getStatus(), /closed/);
    assert.equal((await client.getStatus()).signedIn, true);
    assert.equal(starts, 2);
  } finally {
    client.close();
  }
});

test("active turn cancellation sends interrupt and resolves interrupted", async () => {
  const client = clientFor("wait");
  const controller = new AbortController();
  try {
    const running = client.runTurn({
      workspace: process.cwd(),
      prompt: "test",
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 200);
    assert.equal((await running).status, "interrupted");
  } finally {
    client.close();
  }
});

test("Windows npm shim resolves the native optional dependency without executing batch text", async () => {
  const prefix = path.resolve(".local", `codex-npm-fixture-${randomUUID()}`);
  const pkg = path.join(prefix, "node_modules", "@openai", "codex");
  const native = path.join(pkg, "node_modules", "@openai", "codex-win32-x64");
  const target = path.join(native, "vendor", "x86_64-pc-windows-msvc");
  try {
    await fs.mkdir(path.join(target, "bin"), { recursive: true });
    await fs.mkdir(path.join(target, "codex-path"));
    await fs.writeFile(path.join(pkg, "package.json"), "{}");
    await fs.writeFile(path.join(native, "package.json"), "{}");
    await fs.writeFile(path.join(prefix, "codex.cmd"), "untrusted batch text");
    const exe = path.join(target, "bin", "codex.exe");
    await fs.writeFile(exe, "fixture");
    assert.deepEqual(
      resolveCodexExecutable("codex", {
        platform: "win32",
        arch: "x64",
        pathValue: prefix,
      }),
      { executable: exe, pathDirs: [path.join(target, "codex-path")] },
    );
    assert.equal(
      resolveCodexExecutable(path.join(prefix, "codex.cmd"), {
        platform: "win32",
        arch: "x64",
      }).executable,
      exe,
    );
    await fs.rm(exe);
    await fs.mkdir(path.join(target, "codex"));
    const legacy = path.join(target, "codex", "codex.exe");
    await fs.writeFile(legacy, "fixture");
    assert.equal(
      resolveCodexExecutable("codex", {
        platform: "win32",
        arch: "x64",
        pathValue: prefix,
      }).executable,
      legacy,
    );
    await fs.rm(legacy);
    assert.throws(
      () =>
        resolveCodexExecutable(path.join(prefix, "codex.cmd"), {
          platform: "win32",
          arch: "x64",
        }),
      /native binary is missing/,
    );
  } finally {
    await fs.rm(prefix, { recursive: true, force: true });
  }
});

test("Windows local npm .bin shim resolves a hoisted native package", async () => {
  const prefix = path.resolve(".local", `codex-local-fixture-${randomUUID()}`);
  const modules = path.join(prefix, "node_modules");
  const shim = path.join(modules, ".bin");
  const pkg = path.join(modules, "@openai", "codex");
  const native = path.join(modules, "@openai", "codex-win32-x64");
  const target = path.join(native, "vendor", "x86_64-pc-windows-msvc");
  try {
    await fs.mkdir(shim, { recursive: true });
    await fs.mkdir(pkg, { recursive: true });
    await fs.mkdir(path.join(target, "bin"), { recursive: true });
    await fs.writeFile(path.join(shim, "codex.cmd"), "untrusted batch");
    await fs.writeFile(path.join(pkg, "package.json"), "{}");
    await fs.writeFile(path.join(native, "package.json"), "{}");
    const exe = path.join(target, "bin", "codex.exe");
    await fs.writeFile(exe, "fixture");
    assert.equal(resolveCodexExecutable("codex", { platform: "win32", arch: "x64", pathValue: shim }).executable, exe);
    assert.equal(resolveCodexExecutable(path.join(shim, "codex.cmd"), { platform: "win32", arch: "x64" }).executable, exe);
  } finally { await fs.rm(prefix, { recursive: true, force: true }); }
});
