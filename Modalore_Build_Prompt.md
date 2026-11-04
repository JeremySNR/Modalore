# Modalore — coding-agent kickoff prompt

You are my founding engineer and product designer. Research, design and begin implementing Modalore: an open-source, beginner-friendly application for playing, creating and sharing modifications to games people already own.

Work autonomously through the research and into a working first implementation. Make sensible, reversible decisions and document them. Ask only when a missing decision genuinely blocks progress. Inspect the existing repository and its instructions first; preserve existing work. Use parallel agents for independent research, design and implementation where available.

## Product and identity

Working name: **Modalore**, combining “mod” with Mandalore. My other repositories are Cutawan and Metachlorian. Check obvious naming collisions before public release, but use Modalore throughout the initial build and keep branding easy to change.

Create an original identity. The Star Wars connection belongs mainly in the name; use original marks, typography and assets.

The product promise is: **“Your games. Your rules.”**

Think of a beautiful mod discovery platform where every creation has three clear actions:
- **Play**
- **Make it mine**
- **Share**

Our audience includes people who have never installed a mod, opened a terminal or used an AI coding tool. The core journey is discovering something fun, playing it, changing one thing and sharing a working version. AI creation must genuinely use the local Codex CLI and its agent harness.

## 1. Research first, then act

Do a focused investigation using current official documentation and actual repositories. Date and link your sources, distinguish shipped capabilities from examples and roadmap claims, and record decisions in a concise RESEARCH.md and ARCHITECTURE.md.

Resolve these questions:
- First game: Terraria/tModLoader is the leading candidate. Check installation, supported platforms, mod hooks, build tooling, testing, save isolation, packaging and redistribution. Compare Minecraft or another strong candidate only if it materially changes the choice.
- Existing foundations: inspect Universal Modder, tModLoader and relevant Nexus/Vortex and CurseForge flows. Reuse suitable components with compatible licences and attribution.
- Codex: compare current app-server, SDK and noninteractive CLI integration routes. Verify authentication, account usage, Windows support, protocol maturity, progress, cancellation, approvals and structured results.
- Desktop stack: choose Electron or Tauri based on Windows packaging, local process control, Codex integration and UI delivery. Prefer TypeScript and React for the interface unless the repository gives a better reason.
- Mod execution: decide which requests can use tested game capabilities and which require generated code. Explain the boundary.
- Distribution: determine what can be exported directly, what requires dependencies and what must remain in the player's own game installation.

Keep research proportionate. Make a reasoned choice and start building. Put nonblocking unknowns in a short backlog.

Useful starting points, to revalidate:
- https://github.com/rehan-remade/universal-modder
- https://github.com/tModLoader/tModLoader
- https://github.com/tModLoader/tModLoader/wiki/Basic-tModLoader-Usage-Guide
- https://www.nexusmods.com/vortex
- https://support.curseforge.com/support/solutions/articles/9000196984-installing-modpacks
- https://developers.openai.com/blog/codex-as-a-platform
- https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/codex-sdk
- https://learn.chatgpt.com/docs/cli/reference
- https://learn.chatgpt.com/docs/auth
- https://learn.chatgpt.com/docs/windows/windows-sandbox

## 2. Treat the UI as a core deliverable

Design a premium game library and creative tool. Give it a distinctive visual direction, strong typography, restrained colour, thoughtful spacing, excellent imagery and polished interactions.

Initial direction: warm charcoal surfaces, crisp off-white typography, a restrained amber accent and gameplay-led compositions. Make the interface feel welcoming and beautifully finished. Use colour meaningfully for selection, readiness and feedback. Avoid generic dashboard layouts, excessive cards, neon decoration and developer-console styling.

Create a small design system covering typography, spacing, colour, components, motion and interaction states. Build:
- Discover: compelling playable examples, short descriptions, game filters and compatibility.
- Creation detail: gameplay media, what changes, requirements and the primary actions.
- My library: installed creations, recent projects and previous versions.
- Remix studio: preview, contextual controls, suggested changes and a natural-language input.
- Setup: game detection and Codex connection with clear recovery paths.
- Build status: useful milestones, stop/retry controls and expandable technical detail.

Prioritise one excellent primary screen and its complete interaction flow before expanding. Use realistic content. Label sample content clearly until real creations and footage exist.

Inspect the running UI with browser or desktop automation. Capture screenshots at normal and narrow window sizes, critique the composition and fix defects. Check keyboard access, focus, contrast, reduced motion, long titles, loading, empty, offline and error states. Visual polish is part of completion.

## 3. Make the first-run journey obvious

A new user should be able to:
1. Discover a creation through its page or a shared link.
2. Install/open the desktop companion.
3. Have a supported installed game detected, with a simple folder picker as fallback.
4. Choose a new test world or a copy of an existing save.
5. Press Play and launch the correct setup.
6. Select Make it mine, adjust a control or describe a change.
7. Review a short plain-language summary and build it.
8. Try the result, revise it and export/share that exact version.

Let people browse and play prebuilt creations before connecting Codex. When they choose AI creation, explain the connection and guide them through the supported setup.

Resolve technical choices automatically where reliable. Put advanced settings behind progressive disclosure. Explain unsupported requests in ordinary language and offer a feasible alternative.

## 4. Codex CLI is the real creation engine

This requirement applies to the product at runtime, not only to the agent writing this repository.

Use the player's local Codex installation and supported authentication so eligible users can use their own Codex account allowance for creation. Playing a finished mod must work independently of an AI account.

First prove a small integration: detect Codex, connect, run a scoped task, observe progress, receive an artifact, cancel a task and handle an error.

Research app-server over local stdio for the interactive client; compare SDK or codex exec where appropriate. Current documentation distinguishes these integration routes, and some surfaces are experimental. Verify the installed version, supported schema and release suitability. Record the chosen route and isolate it behind a typed Codex adapter.

Authentication and usage requirements:
- Use supported Codex-managed sign-in/session mechanisms; keep credentials owned by Codex.
- Verify what is permitted for this new local open-source client. Treat future hosted/commercial authentication as a separate decision.
- Do not extract, upload, redistribute or proxy user credentials.
- Preserve the user's configuration and offer available models through supported discovery/defaults.
- Explain that creation consumes their account's applicable allowance and is subject to limits.
- Show usage only when reliably reported. Do not invent remaining tokens, money estimates or unlimited access.
- Handle missing CLI, signed-out state, unsupported version, exhausted allowance, connection loss and interrupted jobs.
- Use supported onboarding with clear installation guidance. Prefer a native Windows path where verified.

Let Codex handle planning, tool use, file changes and iteration. Modalore owns the UI, task workspace, game adapter, artifact validation and installation. Avoid replacing the harness with a homegrown loop of direct model calls.

Bound job duration and repair attempts. Expose genuine task milestones and cancellation. Scope writes to project workspaces; install verified outputs through explicit application operations. Use safe process argument handling, redact sensitive logs and keep the local control channel private. Preserve required approvals and sandbox protections.

## 5. Build a focused, real game integration

Start with Windows and one game. Confirm Terraria/tModLoader unless research identifies a substantial obstacle.

Begin with a small set of dependable mechanics that can be composed into interesting changes: items, damage effects, enemy behaviour, rewards and game events. Simple configuration changes should be immediate and need no model call.

Use a narrow, validated mod format or tested runtime capabilities where appropriate. Codex should genuinely produce and revise saved artifacts from requests. The product must support meaningful variation beyond canned prompt matching.

Keep generated executable code distinct from constrained recipes. A successful build or gameplay test is not a security review. Define the supported execution boundary before enabling arbitrary downloads.

A target demonstration is:
“Enemies I defeat join my army. When I die, they turn against me.”

Treat that as a candidate, not a proven feature. First deliver a smaller, genuinely verified change if necessary, then extend it. Create a few excellent examples using supported behaviour.

The game adapter should handle discovery, compatibility, prerequisites, build/validation, isolated profiles, launching, logs and removal. Keep a clean interface for later games without building a universal framework upfront.

## 6. Make installation and recovery trustworthy

Keep original saves separate. Create named play profiles and snapshot the relevant save state before experiments. Track mod version, game version and dependencies together.

Distinguish:
- reverting the mod files;
- restoring a save checkpoint, which can discard later progress.

Use atomic installation where possible and preserve the last working version after failure. Handle missing dependencies, locked files, interrupted installation and incompatible versions. Avoid automatic upgrades that silently change an existing playable creation.

Label exactly what was checked: schema, build, launch and observed gameplay are different levels of evidence. Show actual recordings when available. Never fabricate successful tests, progress, gameplay clips or compatibility.

Treat imported packages, descriptions and instructions as untrusted. Validate paths, archives, manifests and allowed contents. Keep game files and credentials out of exported packages.

## 7. Make sharing real and small

For the first implementation, deliver versioned package export and import that work across two clean profiles or installations. Include source/recipe, metadata, dependencies, hashes, supported versions, validation evidence and parent-creation attribution where applicable.

Design the share page and link contract alongside this. Implement online publishing only when a real backend exists; otherwise label export/import honestly and document the next step. Never display a fake live share URL.

A shared release should remain immutable. A remix creates a new version and credits its source. Only distribute material the project has permission to distribute.

Defer multiplayer, arbitrary combinations of third-party mods, payments, rankings and a large social platform. Existing single-player sharing remains valuable.

## 8. Implement in milestones

A. Inspect the repo, complete focused research and choose the first architecture.
B. Prove the real Codex connection early; develop the visual direction alongside it.
C. Build the polished discovery-to-remix flow with clearly labelled sample data where needed.
D. Complete one real request → artifact → validation → isolated installation → game launch.
E. Complete export → clean import → play, then revision and recovery.
F. Polish the UI, packaging, documentation and meaningful automated checks.

Continue through implementation rather than stopping after a plan. If authentication, Windows access or the game is unavailable, complete independent work, isolate the missing dependency and state exactly what remains unverified. A UI preview is not proof of a working native integration.

Acceptance checks should cover:
- A novice completes the supported journey without a terminal or manual file editing after guided setup.
- A real Codex task creates an artifact and a follow-up changes it.
- A supported modification works after a fresh game launch.
- The exported version imports into a clean setup.
- A failed/cancelled job leaves the last working version usable.
- Save recovery behaves as described.
- Protocol/process errors and invalid packages fail safely.
- The interface passes visual inspection and essential accessibility checks.

Use meaningful tests for integration, artifact validation, installation and recovery. Test the real Windows/game path when available and report platform gaps clearly.

Deliver working source, setup/run instructions, a concise architecture record, test results and screenshots of the actual interface. Document how contributors can add mechanics or game adapters. Choose an open-source licence compatible with reused code.

Start now by inspecting the repository, researching the risky assumptions and implementing the first milestone. Keep progress updates brief and explain consequential decisions.

