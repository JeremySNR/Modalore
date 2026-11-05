# Contributing

Start with [Getting started](docs/GETTING_STARTED.md) and [Architecture](ARCHITECTURE.md). Use Node 24 and Windows for native validation. Run `npm ci`, `npm run check`, and `npm run test:ui`. For native changes, run `node scripts/smoke-desktop.mjs` after building. Keep production dependencies small and the renderer independent of Node.

## Add a mechanic

1. Document its exact game hook and limitations from official Luanti or tModLoader source/docs.
2. Add a bounded field to the shared recipe schema and explicitly version any incompatible package change.
3. Implement the mechanic in the fixed original runtime. Never execute code from imported recipes.
4. Update controls, plain-language descriptions and the Codex task contract together.
5. Test malicious input, export/import, and failure retaining the prior version.
6. Build and observe the mechanic in a fresh single-player game. Record exact versions and actual evidence; a screenshot of the editor does not count.

## Add a game

Keep discovery, prerequisites, build/validation, profile storage, launch, logs and recovery behind a game adapter. Prove one complete journey before adding generalized abstractions. Preserve original saves and avoid requiring an AI account to play a finished artifact.

For Luanti changes, `node scripts/smoke-luanti.mjs` checks actual downloads, native Play, fresh-world sharing and checkpoint restore in `.local`. It opens two short game sessions and downloads about 25 MB. `npx tsx scripts/probe-luanti.ts <runtime-folder>` additionally exercises real Codex creation/revision and consumes the configured account allowance. Neither belongs in the default offline test suite. Record API readback separately from physical movement and visual gameplay evidence.

## Design and performance

Use the [design research](docs/design-research.md). Test normal/narrow widths, keyboard access, reduced motion, long names and error states. Avoid remote fonts, autoplay media, unnecessary polling and blocking I/O. Include before/after screenshots and measured timings for material UI changes.

## Pull requests

Describe the user-visible change, test evidence and remaining limits. Keep changes focused; do not mark a gameplay path verified without a real game test. Contributions are MIT-licensed. Only contribute assets you can redistribute.
