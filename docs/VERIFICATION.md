# Verification record

Checked on Windows x64, 4 November 2026. This record separates real integrations, simulated tests, and work that requires the game.

| Area | Evidence | Limit |
| --- | --- | --- |
| Local Codex | Installed `0.166.0-alpha.6`: actual account read, model discovery, progress, approved artifact creation, follow-up revision, cancellation. An isolated npm install of stable `0.166.0` also passed native executable resolution, initialization and account read. | No claim of broad version support or enforced sandbox isolation; stable version has connection evidence, not the full creation probe |
| Real recipe journey | Codex created current-schema recipe, revised coins, validated and saved it, exported/imported into a second clean profile; interrupted follow-up retained saved versions | No game process involved; consumes the configured account allowance |
| Desktop | Actual Electron preload, isolated renderer, project create/update, persistence and library navigation exercised | Local development machine, not a fresh Windows installation |
| Import and recovery | Automated tests cover hash/field rejection, clean profiles, invalid updates, recipe rollback, save checkpoint restore, journal recovery and linked-directory rejection | Filesystem and simulated process tests; not in-game save validation |
| Codex protocol failures | Fake protocol peer exercises approvals, wrong-thread requests, lost connections, retry, errors, limit codes and interruption | A simulated peer cannot prove every current/future server variant |
| Runtime build and launch | Fixed original C# template and actual tModLoader process adapter implemented; simulated child tests verify output/hash gating, lock, launch failure rollback and cancellation | Neither Terraria nor tModLoader was installed. C# compilation, game launch, compatibility and gameplay are unverified |
| Visual UI | Actual renderer screenshots at 1440px and 390px; native desktop screenshot; wide/narrow interactions and axe A/AA checks | Automated accessibility checks are not full screen-reader or novice user research |
| Dependencies | npm audit reports zero known vulnerabilities after patched build dependencies | Audits are not a security certification |

## Reproduce

`npm run check` runs type checking, the integration tests and a production build. `npm run test:ui` serves the app and runs browser interactions/accessibility checks. `node scripts/smoke-desktop.mjs` launches real Electron. `npx tsx scripts/probe-codex.ts` is an optional real-account probe; it uses allowance and confines its artifacts to `.local`.

The release-candidate local unrestricted run passed all 23 Node tests, including the symlink case, plus all three served UI tests. Restricted Windows runs can skip link creation because the development sandbox denies it. CI and subsequent additions are visible in [GitHub Actions](https://github.com/JeremySNR/Modalore/actions).

## Performance

One local development launch reached the rendered Discover page in 220 ms. Five navigation measurements were 90, 25, 16, 17 and 16 ms including automation overhead. Aggregate reported process working sets were approximately 365 MiB; they are not a measurement of unique physical memory. There were no renderer errors. The renderer JS was about 253 kB before gzip, 78 kB after gzip. These are local observations, not a promised startup time or a controlled cold-start benchmark. The latest reproducible run is saved in [performance-local.json](performance-local.json).

System fonts and local SVG assets avoid download delays. Browsing does not start Codex or depend on a remote service. No autoplay, background polling or decorative motion framework is included. Low-end hardware, large libraries, installer first-run and long-session memory still need measured coverage.

## Stable-release blockers

1. Build the runtime against a pinned tModLoader release, launch, and observe every supported mechanic in a new single-player world.
2. Verify original saves remain untouched and test recovery after actual game writes. Test sharing across two real installations.
3. Validate supported stable Codex versions and clean-machine Windows sign-in/sandbox setup. The observed file approval requested an unsandboxed retry; we explicitly approved the named test patch only.
4. Test installer/uninstaller on a fresh PC and sign Windows binaries. Preview binaries are unsigned.
5. Strengthen the narrow child-spawn/process-lock crash interval, test real power loss and locked-file failure modes, and add explicit user-selected save copying.

There is no live publishing backend, gameplay video, stable game compatibility badge, arbitrary mod execution or multiplayer support. The enemy-army demonstration remains a future mechanic. The current release should be presented as an experimental recipe studio, not as a verified playable mod catalogue.
