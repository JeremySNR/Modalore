# Build brief acceptance review

Reviewed 5 November 2026 for the Windows alpha.3 preview. This is a working first implementation, with the limits below; it is not a stable-release certification.

| Brief milestone | Delivered | Remaining boundary |
| --- | --- | --- |
| A. Research and architecture | Repository inspection; dated game, Codex, stack and design research; architecture and licensing records | Terraria was an example and is unavailable on the development PC. Free Luanti + Minetest Game is the exercised path |
| B. Actual creation engine | Local Codex app-server, managed sign-in, model discovery/default preservation, approvals, progress, real artifact creation/revision and cancellation | Broad stable-version compatibility and clean-machine sandbox/onboarding remain unverified |
| C. Discovery to remix | Original concept art, discovery/detail, game filters, library, studio, setup, progress, history and reversible archive | Art is explicitly labelled; there is no gameplay footage or live community catalogue |
| D. Request to game | Actual Codex recipe → validation → isolated profile → native Luanti client → session-bound player-settings report | Supported mechanics are speed, jump and gravity. No enemy-army mechanic or arbitrary generated code |
| E. Sharing and recovery | Exact immutable recipe export/import/re-export, clean imported world, same-world revision, checkpoint recovery, startup failure and retry | Clean profiles are on one PC. No online publishing; existing-save copying is deferred |
| F. Polish and distribution | Reviewed normal/narrow desktop UI, keyboard/focus/reduced-motion/axe checks, system fonts, measured startup, public GitHub, original README art, Windows installer/portable builds and checksums | Unsigned preview. Fresh-PC installation, long sessions and novice user studies remain outstanding |

## Acceptance evidence

- **No-terminal supported play flow:** native setup, sample creation, Play, slider changes, export/import and recovery are exercised through the desktop bridge and UI. Game download uses pinned official archives. Codex installation is a separate guided prerequisite for natural-language creation.
- **Real AI changes:** the player's local CLI produced and revised an artifact. No direct-model substitute or prompt-matching mock is used. Sliders do not consume AI allowance.
- **Real game integration:** native clients joined isolated worlds and reported the exact requested physics. A separate engine probe recorded player movement with random input. Neither result is presented as human visual playtesting.
- **Failure integrity:** invalid/cancelled jobs preserve committed recipes. Deliberate engine startup failure presents diagnostics and permits retry. Checkpoint restoration returns the exact pre-revision world database.
- **Package and process boundaries:** exact schema/hash/dependency validation, archive path/link checks, serialized mutations, process locks and journal recovery have automated coverage. The known narrow process-spawn crash interval is documented.
- **Visual quality:** actual screenshots, readable system typography, restrained colour, original labelled art and accessible interaction states. No fabricated game footage, social metrics, usage balances or share URLs.

See [the detailed verification record](VERIFICATION.md) for reproducible commands and remaining stable-release work, [the walkthrough](GETTING_STARTED.md) for user instructions, and [the package contract](PACKAGE_FORMAT.md) for sharing semantics.

## Next validation work

The highest-value next step is supervised play and first-run testing on a clean Windows PC: install the preview, set up the free game, move and jump, revise a recipe, exchange it with another PC and restore a checkpoint. Follow that with signing, controlled physics measurements, longer sessions and explicit save-copying/removal UX. These are recorded as outstanding rather than implied by passing automated tests.
