# Modalore architecture

Decision date: 4 November 2026. Windows first; Electron + React + TypeScript; Terraria/tModLoader first; local Codex CLI app-server for natural-language creation. See [research](RESEARCH.md).

## Ownership

```text
React renderer (no Node, no credentials, local assets)
  → narrow context-isolated preload API
  → Electron main process (validates sender and data)
      → ProjectStore: saved metadata and bounded version history
      → CodexClient: private stdio → installed codex app-server
      → game adapter: validated recipes, package hashing, profiles, build, launch
```

The renderer never receives a general shell, file API, IPC channel or arbitrary external URL opener. Production content loads through a restricted custom protocol. Navigation, popups and permission requests are denied. User text renders as text. Native dialogs own file selection and explicit approvals.

## Creation and trust boundaries

Simple controls save validated recipe JSON without model calls. Natural-language work runs in a new job directory containing a copy of the current recipe. Codex owns planning, tools and edits. The adapter requests workspace-write, network disabled, on-request approval and a bounded turn. A real CLI may request additional permission; the UI presents it and defaults to decline. This is not a guarantee that every installed Codex version enforces Windows sandboxing identically.

After a successful turn, Modalore checks the artifact’s type, size, exact schema and finite bounded numbers. A turn marked completed is insufficient on its own. Invalid, unchanged, failed and cancelled outputs leave the saved project unchanged. The only C# generated is the application’s fixed original template with validated numeric substitutions. Imported packages cannot supply C# or paths.

The local default model/configuration is preserved. The adapter supports model discovery, but the first UI uses the configured default. Credentials are not read, copied or proxied. Progress is derived from protocol events; no fabricated percentages or token balances.

## Storage and versions

App-owned workshop storage contains project metadata, per-project immutable recipe files addressed by SHA-256, a current pointer, job workspaces, profiles and checkpoints. JSON writes use staging and rename. Game installation stages a locally built artifact, verifies its hash, and preserves prior installed files on failure. Imported recipes create fresh profiles. There is no automatic dependency upgrade or arbitrary third-party mod mix.

Checkpoints contain only profile Worlds and Players. Recipe rollback and save restore are separate operations. Restore stages the new save tree and rolls back on a failed swap; recovery journals cover interrupted save swaps and mod installation. Original Terraria saves are never enumerated/copied automatically. Persistent process locks block mutation across application restarts. A narrow crash window between child process creation and recording its PID remains; stronger operating-system coordination is a stable-release requirement.

## Execution evidence

Schema, build, process start, and observed gameplay are different levels. Exported packages conservatively carry schema evidence only and `supportedVersions: unverified`. Their content hash proves consistency, not publisher identity or executable safety. The runtime/build/launch path needs real game verification before any stable release.

## Sharing

The shipped contract is a bounded `.modalore.json` package with format version, recipe, dependencies, parent hash, hash and evidence. The parent hash identifies canonical recipe content; the outer hash identifies the entire package. Import preserves the package's ancestry, while a remix points to the prior recipe hash. Reverting restores prior content and ancestry together. See [package format](docs/PACKAGE_FORMAT.md). No archives, arbitrary file trees, credentials, game content or saves. A later hosted share page should address an immutable package by digest and show exactly the same dependency/evidence information. No publisher backend or live share URL exists yet.

## Performance

System fonts, bundled lightweight SVGs, one local window, asynchronous disk I/O, small renderer bundle and no polling/network dependency for browsing. Codex is started on demand. Model work and compilation occur in child processes. Build limits and cancellation prevent an invisible unbounded agent loop. Use the reproducible desktop smoke script and record measurements with their environment; do not equate browser preview speed with desktop startup.
