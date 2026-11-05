Modalore alpha.2 adds a free first game, version history and reversible project archiving.

Download **Setup.exe** for an installer or **Portable.exe** to try without installing. Windows x64 only. These preview builds are unsigned; `SHA256SUMS.txt` records the exact download hashes.

### Start playing

1. Open **Setup → Set up free game** (about 25 MB).
2. Open **Long strides → Play sample**. Each project gets its own Minetest Game world, powered by Luanti.
3. Close the game, change speed/jump/gravity with sliders or your local Codex CLI, save and play again.
4. Export the recipe file. A friend can import it and play in a fresh world.

Sliders, playing and file sharing do not require an AI account. Natural-language creation uses your separately installed Codex CLI and your account's applicable allowance. Credentials stay managed by Codex.

### What was checked

Real Codex recipe creation/revision, real Luanti client/player-settings readback, native setup/download/Play, exact export/re-import, a fresh imported world, checkpoint restoration after game writes, cancellation and version recovery. Luanti 5.18.0 and a pinned Minetest Game revision are used. Local tests and CI results are documented in the repository.

### Preview limits

Player-settings readback is separate from visually observed movement. Game-window screenshot inspection timed out waiting for Computer Use approval, so gameplay footage and physical movement acceptance are still outstanding. Clean-PC onboarding and installer/uninstaller tests remain incomplete. Terraria/tModLoader remains experimental and unverified; it is not required for the free-game path. Concept illustrations are not game footage. No hosted sharing, multiplayer, arbitrary mod code or automatic updates.

Keep important recipes exported and use the app-owned worlds. [Getting started](https://github.com/JeremySNR/Modalore/blob/main/docs/GETTING_STARTED.md) · [Verification](https://github.com/JeremySNR/Modalore/blob/main/docs/VERIFICATION.md)
