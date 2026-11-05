<p align="center"><img src="docs/banner.svg" alt="Modalore — Your games. Your rules." width="100%"></p>

<p align="center">
  <a href="https://github.com/JeremySNR/Modalore/releases/download/v0.1.0-alpha.1/Modalore-0.1.0-alpha.1-Windows-x64-Setup.exe"><strong>Windows installer</strong></a> ·
  <a href="https://github.com/JeremySNR/Modalore/releases/download/v0.1.0-alpha.1/Modalore-0.1.0-alpha.1-Windows-x64-Portable.exe">Portable download</a> ·
  <a href="docs/GETTING_STARTED.md">Getting started</a> ·
  <a href="docs/VERIFICATION.md">What actually works</a> ·
  <a href="https://github.com/JeremySNR/Modalore/issues">Feedback</a>
</p>

[![Checks](https://github.com/JeremySNR/Modalore/actions/workflows/check.yml/badge.svg)](https://github.com/JeremySNR/Modalore/actions/workflows/check.yml) [![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[0.1.0-alpha.1 release notes and checksums](https://github.com/JeremySNR/Modalore/releases/tag/v0.1.0-alpha.1). Unsigned Windows x64 preview.

**Modalore is an open-source desktop app for making small changes to games you own.** Start with a recipe, adjust it with simple controls, or describe a change to your local Codex CLI. Save the result and send the recipe to a friend.

**Early Windows preview — not a finished mod launcher.** Local recipe creation, revision, import/export and recovery are implemented. Real Codex artifact creation, follow-up and cancellation have been exercised. Terraria/tModLoader was unavailable during development: the runtime build, game launch, game compatibility and in-game save isolation still need validation. The app labels those gaps and asks before attempting an experimental play session. See the [verification record](docs/VERIFICATION.md).

![The actual Modalore desktop interface](docs/desktop-native.png)

### Try it

1. Open [Releases](https://github.com/JeremySNR/Modalore/releases) and choose the latest **Windows preview**.
2. Download the **Setup .exe** to install, or the **Portable .exe** to try without installing. Both are Windows x64. These preview downloads are **unsigned**, so Windows may show an unknown-publisher warning. Only use files from this repository and compare the supplied SHA-256 checksum if needed.
3. Open Modalore, choose an idea, and select **Make it mine**.
4. Adjust **player damage**, **enemy health**, or **coin rewards**, then save. No AI account is needed for sliders, importing or exporting recipes.
5. For natural-language changes, open **Setup → Codex connection**. Modalore uses your installed Codex CLI and its supported sign-in. Creation uses your account’s applicable allowance.

For experimental game testing, install your own **Terraria** and **tModLoader** through Steam. Select their location in Setup, then use Play. The app builds its own small runtime and requests a separate profile; create a **new single-player character and world**. Do not use original saves or multiplayer in this preview. [Read the full walkthrough](docs/GETTING_STARTED.md).

### What you can make

Recipes change three bounded values from 50% to 300%: player damage, hostile enemy health, and enemy coin rewards. Try “Give enemies twice the health and double their coin rewards.” Fine-tune the same values without a model call.

Requests such as “Defeated enemies join my army” require mechanics that are **not implemented**. Codex is instructed to explain that boundary. Imported recipes contain data only; they cannot add executable code.

| Available in this preview                                            | Still to prove or build                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Windows desktop UI, local library, original concept illustrations    | Gameplay footage and a verified playable gallery             |
| Real local Codex app-server connection, approvals, progress and stop | Broad stable-CLI compatibility and clean-machine onboarding  |
| Validated recipes, immutable versions, hash-checked import/export    | Game build and actual gameplay acceptance tests              |
| Separate profile directories and tested save-copy/restore operations | In-game isolation validation, copying an existing save       |
| File sharing with parent-version attribution                         | Hosted publishing, live share pages, rankings or multiplayer |

There are no fake live share links, download counts, usage balances or gameplay recordings. A successful schema check is not a successful game test. Package hashes check integrity; they do not establish who made a file.

### Build from source

Use Windows x64, Node.js 24 LTS and Git. The UI also runs as a browser preview, with native actions clearly unavailable.

```powershell
git clone https://github.com/JeremySNR/Modalore.git
cd Modalore
npm ci
npm run dev
```

```powershell
npm run check          # Type checking, integration tests, production build
npm run test:ui        # Browser interactions and accessibility
node scripts/smoke-desktop.mjs  # Actual Electron bridge and startup measurement
npm run dist:win       # Windows installer and portable downloads in release/
```

`npm run dev:web` starts only the interface. It does not simulate successful native operations. Codex is started only when connecting or creating, not while browsing. No API key needs to be pasted into Modalore.

### Help shape it

The most useful contributions now are **real tModLoader testing**, Windows first-run feedback, and small, testable mechanics. Report what you tried, your versions, and what happened. Don’t attach saves, credentials or private Codex logs to a public issue.

Read [CONTRIBUTING](CONTRIBUTING.md), [ARCHITECTURE](ARCHITECTURE.md), the [research record](RESEARCH.md), and the [design research](docs/design-research.md). The source and original artwork are MIT-licensed. Terraria, tModLoader, Codex, and their trademarks belong to their respective owners; this project is independent and ships none of their game assets.
