# Research and decisions

Checked 4 November 2026 against current official documentation, repositories and local executables. Research is separated from observed execution. [Codex details](docs/research-codex.md), [game details](docs/research-game.md), [UI research](docs/design-research.md).

| Question | Decision and evidence |
| --- | --- |
| First game | Terraria/tModLoader: established hooks, source builds, Steam installation and profile directories. The [official project](https://github.com/tModLoader/tModLoader) is the foundation. Neither game was found locally. Minecraft adds loader/version branches without removing the need for local game verification, so it is deferred. |
| Existing work | Reviewed [Universal Modder](https://github.com/rehan-remade/universal-modder), [Vortex](https://www.nexusmods.com/vortex), and [CurseForge](https://support.curseforge.com/support/solutions/articles/9000196984-installing-modpacks). Reuse patterns—discover, install, profile—not assets or executable code. Original runtime and UI; no copied source requiring a relicensing decision. |
| Codex route | [App-server](https://learn.chatgpt.com/docs/app-server) fits interactive approvals, threads, progress and cancellation. SDK/exec suit simpler scripted work. Installed CLI `0.166.0-alpha.6` exposes experimental app-server; its generated schema was inspected. Real artifact creation/revision/cancellation were exercised. |
| Auth | Codex-managed local sign-in only. No direct model calls, credential extraction or account proxy. Account allowance and version-specific behaviour apply. Hosted/commercial auth and any separate open-source sign-in eligibility are not assumed approved. |
| Desktop stack | Electron over Tauri for shared TypeScript process tooling, React delivery and direct app-server stdio. Tauri would reduce bundled browser footprint but add Rust and a second integration boundary. Electron’s [security](https://www.electronjs.org/docs/latest/tutorial/security/) and [performance](https://www.electronjs.org/docs/latest/tutorial/performance) guidance inform implementation. Measure actual cost; do not market it as lightweight without evidence. |
| Execution | Fixed original runtime + narrow validated data. First mechanics: player damage, enemy health, coins. Universal velocity scaling was rejected because per-tick multiplication can accumulate and interfere with AI. Allies-on-death is not implemented. |
| Distribution | Share data recipes, dependencies, hashes and attribution. Do not redistribute Terraria, game art, saves or other creators’ mods. Unsigned Windows preview; stable release requires signing and actual game validation. |
| Naming | Exact-name web and GitHub checks did not reveal an obvious competing game-mod application. This is a preliminary collision check, not a trademark clearance. Branding stays in a few app/docs assets. |

## Remaining research

Pin and test a supported tModLoader version and current stable Codex release; verify clean Windows onboarding and sandbox behaviour; assess real game hooks and save isolation; test two actual installations; review distribution/auth terms before stable or commercial publication. These are release-readiness gaps, not proof that the design cannot work.
