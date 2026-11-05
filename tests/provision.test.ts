import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  extractVerifiedArchive,
  setupLuantiRuntime,
} from "../src/main/game/provision.js";

// Minimal stored ZIPs let us test hostile entry metadata without third-party fixtures.
function zip(name: string, content = "ok", external = 0) {
  const n = Buffer.from(name),
    d = Buffer.from(content),
    local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(d.length, 18);
  local.writeUInt32LE(d.length, 22);
  local.writeUInt16LE(n.length, 26);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x0314, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(d.length, 20);
  central.writeUInt32LE(d.length, 24);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(external >>> 0, 38);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + n.length, 12);
  end.writeUInt32LE(local.length + n.length + d.length, 16);
  return Buffer.concat([local, n, d, central, n, end]);
}
test("archive extraction rejects traversal, Windows names and links", async () => {
  const root = path.resolve(".local", `provision-test-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true });
  try {
    for (const [name, attr] of [
      ["root/../escape", 0],
      ["root/C:/evil", 0],
      ["root/CON.txt", 0],
      ["root/file", 0xa0000000],
    ] as const) {
      const archive = path.join(root, `${randomUUID()}.zip`);
      await fs.writeFile(archive, zip(name, "x", attr));
      const target = path.join(root, randomUUID());
      await fs.mkdir(target);
      await assert.rejects(
        extractVerifiedArchive(
          archive,
          target,
          "root",
          new AbortController().signal,
        ),
      );
    }
    assert.equal(
      await fs.stat(path.join(root, "escape")).then(
        () => true,
        () => false,
      ),
      false,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("setup preserves unknown installation and handles cancellation", async () => {
  const root = path.resolve(".local", `provision-test-${randomUUID()}`),
    target = path.join(root, "runtimes", "luanti-5.18.0");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "keep"), "untouched");
  try {
    await assert.rejects(setupLuantiRuntime(root), /left untouched/);
    assert.equal(
      await fs.readFile(path.join(target, "keep"), "utf8"),
      "untouched",
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      setupLuantiRuntime(root, { signal: controller.signal }),
      /cancelled/,
    );
    assert.equal(
      await fs.readFile(path.join(target, "keep"), "utf8"),
      "untouched",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("bad download checksum removes only owned staging", async () => {
  const root = path.resolve(".local", `provision-test-${randomUUID()}`);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("wrong bytes", { status: 200 });
  try {
    await assert.rejects(setupLuantiRuntime(root), /checksum/);
    assert.deepEqual(await fs.readdir(path.join(root, "runtimes")), []);
  } finally {
    globalThis.fetch = original;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("download progress identifies the source and is bounded across small chunks", async () => {
  const root = path.resolve(".local", `provision-test-${randomUUID()}`);
  const original = globalThis.fetch;
  const messages: string[] = [];
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (let i = 0; i < 500; i++)
            controller.enqueue(new Uint8Array(1024));
          controller.close();
        },
      }),
    );
  try {
    await assert.rejects(
      setupLuantiRuntime(root, {
        onProgress: (message) => messages.push(message),
      }),
      /checksum/,
    );
    const updates = messages.filter((message) =>
      message.startsWith("Luanti: downloaded"),
    );
    assert.ok(updates.length <= 2);
    assert.ok(updates.some((message) => message.includes("0.5 MiB")));
  } finally {
    globalThis.fetch = original;
    await fs.rm(root, { recursive: true, force: true });
  }
});
