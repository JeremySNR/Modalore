import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CodexClient, artifactPrompt, redact } from '../src/main/codex/index';

const fake = fileURLToPath(new URL('./codex-fake-server.ts', import.meta.url));
const clientFor = (mode: string) => new CodexClient('codex', () => spawn(process.execPath, [fake, mode], { stdio: 'pipe' }));

test('artifact prompt restricts the output name', () => {
  assert.throws(() => artifactPrompt('hi', '../outside.json'));
  assert.match(artifactPrompt('make it blue', 'recipe.json'), /recipe\.json/);
});

test('credentials are removed from displayed messages', () => {
  assert.doesNotMatch(redact('Bearer abcdef sk-secret123 eyJabc.def.ghi'), /abcdef|sk-secret123|eyJabc/);
});

test('missing CLI reports failure and aborted tasks do not start', async () => {
  const client = new CodexClient('modalore-nonexistent-codex-command');
  await assert.rejects(client.start());
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.runTurn({ workspace: process.cwd(), prompt: 'test', signal: controller.signal }), /cancelled/);
  client.close();
});

test('protocol preserves sandbox settings and reports completion', async () => {
  const client = clientFor('normal');
  try {
    const result = await client.runTurn({ workspace: process.cwd(), prompt: 'test' });
    assert.equal(result.status, 'completed'); assert.equal(result.message, 'done');
  } finally { client.close(); }
});

test('approval carries actual file paths and declines by default', async () => {
  const client = clientFor('approval');
  try {
    const denied = await client.runTurn({ workspace: process.cwd(), prompt: 'test' });
    assert.equal(denied.message, 'decline');
    const approved = await client.runTurn({ workspace: process.cwd(), prompt: 'test', onApproval: async approval => {
      assert.equal(approval.kind, 'fileChange'); assert.deepEqual(approval.paths, ['recipe.json']);
      return 'accept';
    } });
    assert.equal(approved.message, 'accept');
  } finally { client.close(); }
});

test('approval from a different thread is never sent to the callback', async () => {
  const client = clientFor('wrong-thread'); let called = false;
  try {
    const result = await client.runTurn({ workspace: process.cwd(), prompt: 'test', onApproval: async () => { called = true; return 'accept'; } });
    assert.equal(result.message, 'decline'); assert.equal(called, false);
  } finally { client.close(); }
});

test('failed requests redact secrets and connection loss while starting a turn is handled', async () => {
  for (const mode of ['start-error', 'start-close']) {
    const client = clientFor(mode);
    try { await assert.rejects(client.runTurn({ workspace: process.cwd(), prompt: 'test' }), error => error instanceof Error && !error.message.includes('sk-secret123')); }
    finally { client.close(); }
  }
});

test('unexpected exit permits a fresh connection', async () => {
  let starts = 0;
  const client = new CodexClient('codex', () => spawn(process.execPath, [fake, ++starts === 1 ? 'exit' : 'normal'], { stdio: 'pipe' }));
  try {
    await assert.rejects(client.getStatus(), /closed/);
    assert.equal((await client.getStatus()).signedIn, true);
    assert.equal(starts, 2);
  } finally { client.close(); }
});

test('active turn cancellation sends interrupt and resolves interrupted', async () => {
  const client = clientFor('wait'); const controller = new AbortController();
  try {
    const running = client.runTurn({ workspace: process.cwd(), prompt: 'test', signal: controller.signal });
    setTimeout(() => controller.abort(), 200);
    assert.equal((await running).status, 'interrupted');
  } finally { client.close(); }
});
