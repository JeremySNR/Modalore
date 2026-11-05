# Changelog

## Unreleased

- Browse up to 30 earlier recipes, compare their values, and restore one while retaining the outgoing version and its attribution.
- Archive projects without deleting their saves or history; bring them back from the Archived library view.
- Validate legacy history and project hashes before changing a profile. Recover the committed version if a history restore cannot save metadata.
- Isolate Electron cache and instance locks when using an explicit test data directory.
- Exercise version restoration, archive/reopen recovery, keyboard focus and narrow-window accessibility through the real desktop bridge.

## 0.1.0-alpha.1 — 2026-11-05

First Windows preview.

- Research-led, compact desktop interface with system fonts and original labelled concept art.
- Discover, detail, local library, setup, remix review, progress and recovery flows.
- Actual local Codex CLI app-server integration, supported sign-in, scoped jobs, explicit approvals and cancellation.
- Bounded player damage, enemy health and coin recipe schema; fixed original tModLoader runtime source.
- Versioned recipe storage, immutable package export/import and parent-recipe attribution.
- Separate profiles, save checkpoints, persistent process locks, recovery journals and failure rollback.
- Installer and portable Windows x64 packaging, checksums, CI, documentation and reproducible tests.

**Known limits:** game/runtime/build/launch/compatibility are unverified without Terraria/tModLoader; no hosted publishing or arbitrary code; unsigned preview binaries; clean-machine onboarding still needs testing. See [Verification](docs/VERIFICATION.md).
