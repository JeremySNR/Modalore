# Modalore architecture

Decision dates: 4–5 November 2026. Windows first; Electron + React + TypeScript; Luanti/Minetest Game is the first locally exercised game path; Terraria/tModLoader remains experimental. Natural-language creation uses the local Codex CLI app-server. See [research](RESEARCH.md).

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

The Luanti recipe is a separate discriminated schema for speed, jump and gravity. Its original Lua runtime is hash-checked and substituted with validated numbers only. The server mod applies physics overrides on join/respawn and writes a report bound to a fresh launch nonce. Main validates the engine version, game identity and values before saying player settings were confirmed. That evidence is API readback, not visual movement. Existing projects cannot switch game types through an edit.

Free-game setup streams two pinned official archives, verifies SHA-256, rejects unsafe archive entries, bounds download/extraction size and stages installation before rename. It retains upstream license files and never overwrites an unknown existing runtime. Luanti starts visibly with an explicit per-project world under `saves/Worlds/luanti`, a local-only connection, Lua sandbox enabled and a separate config/log. Its process lock survives the desktop app closing; engine caches may still be written inside the managed runtime.

The local default model/configuration is preserved. The adapter supports model discovery, but the first UI uses the configured default. Credentials are not read, copied or proxied. Progress is derived from protocol events; no fabricated percentages or token balances.

## Storage and versions

App-owned workshop storage contains project metadata, per-project immutable recipe files addressed by SHA-256, a current pointer, job workspaces, profiles and checkpoints. JSON writes use staging and rename. Game installation stages a locally built artifact, verifies its hash, and preserves prior installed files on failure. Imported recipes create fresh profiles. There is no automatic dependency upgrade or arbitrary third-party mod mix.

Visible history retains up to 30 prior recipe states with their original parent hashes. Restoring a selected entry saves the outgoing state rather than truncating later history. Old rollback-only records migrate in memory with stable entry IDs and no invented dates. Metadata remains the transaction commit point; failed writes roll the profile pointer back. Archiving is a reversible metadata flag, leaves profile files intact, and rejects edits/play until unarchived. An explicit `MODALORE_DATA_DIR` also isolates Electron's cache and instance lock using [its supported path API](https://www.electronjs.org/docs/latest/api/app/), before app readiness.

Checkpoints contain only profile Worlds and Players. Recipe rollback and save restore are separate operations. Restore stages the new save tree and rolls back on a failed swap; recovery journals cover interrupted save swaps and mod installation. Original Terraria saves are never enumerated/copied automatically. Persistent process locks block mutation across application restarts. A narrow crash window between child process creation and recording its PID remains; stronger operating-system coordination is a stable-release requirement.

## Execution evidence

Schema, build, process start, connected-player readback, and observed gameplay are different levels. Exported packages conservatively carry schema evidence only. Terraria packages declare versions unverified; Luanti packages name the tested engine/game pair. Their content hash proves consistency, not publisher identity or executable safety. Terraria still needs compilation and gameplay validation. Luanti has real client and recovery evidence, but visual movement and broader platform tests remain outstanding.

## Sharing

The shipped contract is a bounded `.modalore.json` package with format version, recipe, dependencies, parent hash, hash and evidence. The parent hash identifies canonical recipe content; the outer hash identifies the entire package. Import preserves the package's ancestry, while a remix points to the prior recipe hash. Reverting restores prior content and ancestry together. See [package format](docs/PACKAGE_FORMAT.md). No archives, arbitrary file trees, credentials, game content or saves. A later hosted share page should address an immutable package by digest and show exactly the same dependency/evidence information. No publisher backend or live share URL exists yet.

## Performance

System fonts, bundled lightweight SVGs, one local window, asynchronous disk I/O, small renderer bundle and no polling/network dependency for browsing. Codex is started on demand. Model work and compilation occur in child processes. Build limits and cancellation prevent an invisible unbounded agent loop. Use the reproducible desktop smoke script and record measurements with their environment; do not equate browser preview speed with desktop startup.
