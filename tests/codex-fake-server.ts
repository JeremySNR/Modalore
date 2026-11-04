// A small protocol peer for adapter tests. No network or Codex credentials are used.
import { createInterface } from "node:readline";
const mode = process.argv[2];
const send = (value: object) =>
  process.stdout.write(`${JSON.stringify(value)}\n`);
let startId: number | undefined;
createInterface({ input: process.stdin }).on("line", (line) => {
  const m = JSON.parse(line);
  if (m.id === 700) {
    const decision = m.result?.decision ?? "error";
    send({
      method: "item/agentMessage/delta",
      params: { threadId: "thread", delta: decision },
    });
    send({
      method: "turn/completed",
      params: { threadId: "thread", turn: { id: "turn", status: "completed" } },
    });
  } else if (m.method === "initialize") send({ id: m.id, result: {} });
  else if (m.method === "account/read") {
    if (mode === "exit") process.exit(1);
    else send({ id: m.id, result: { account: { type: "chatgpt" } } });
  } else if (m.method === "thread/start")
    send({ id: m.id, result: { thread: { id: "thread" } } });
  else if (m.method === "turn/start") {
    const p = m.params;
    if (
      p.approvalPolicy !== "on-request" ||
      p.sandboxPolicy?.type !== "workspaceWrite" ||
      p.sandboxPolicy.networkAccess !== false ||
      p.sandboxPolicy.writableRoots?.[0] !== p.cwd
    ) {
      send({ id: m.id, error: { message: "unsafe sandbox parameters" } });
      return;
    }
    if (mode === "start-error") {
      send({ id: m.id, error: { message: "quota sk-secret123" } });
      return;
    }
    if (mode === "start-close") {
      process.exit(1);
      return;
    }
    startId = m.id;
    send({ id: m.id, result: { turn: { id: "turn", status: "inProgress" } } });
    if (mode === "approval" || mode === "wrong-thread") {
      send({
        method: "item/started",
        params: {
          threadId: "thread",
          item: {
            type: "fileChange",
            id: "item",
            changes: [{ path: "recipe.json", diff: "private", kind: "add" }],
          },
        },
      });
      send({
        id: 700,
        method: "item/fileChange/requestApproval",
        params: {
          threadId: mode === "wrong-thread" ? "other" : "thread",
          turnId: "turn",
          itemId: "item",
          reason: "approval needed",
        },
      });
    } else if (mode === "quota") {
      send({
        method: "turn/completed",
        params: {
          threadId: "thread",
          turn: {
            id: "turn",
            status: "failed",
            error: {
              codexErrorInfo: "usageLimitExceeded",
              message: "private details",
            },
          },
        },
      });
    } else if (mode === "normal") {
      send({
        method: "item/agentMessage/delta",
        params: { threadId: "thread", delta: "done" },
      });
      send({
        method: "turn/completed",
        params: {
          threadId: "thread",
          turn: { id: "turn", status: "completed" },
        },
      });
    }
  } else if (m.method === "turn/interrupt" && startId) {
    send({ id: m.id, result: {} });
    send({
      method: "turn/completed",
      params: {
        threadId: "thread",
        turn: { id: "turn", status: "interrupted" },
      },
    });
  }
});
