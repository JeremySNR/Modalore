# Your first Modalore recipe

## Download and open

Use the [official GitHub releases](https://github.com/JeremySNR/Modalore/releases). Choose the Setup download for a normal installation; Portable runs without an installer. This early preview is Windows x64 only and is not code-signed. You do not need Node, Git, or a terminal to browse, use the controls, or share recipes in a downloaded build.

## Change one thing

1. On Discover, open **The Wildwood**. Its picture is original concept art, not a gameplay screenshot.
2. Choose **Make it mine**.
3. Move **Coins** to 150%, then choose **Create project**. This saves locally.
4. Open My library to return to it. Use **Export this version** to save a small `.modalore.json` file.
5. On another Modalore installation, choose **My library → Import project** and select that file. A separate project is created. Importing a recipe does not install a game or execute code.

## Describe a change with Codex

Install the [official Codex CLI](https://developers.openai.com/codex/cli/) using OpenAI’s current Windows instructions. The separately installed CLI is required; downloading Modalore does not install it. This prerequisite may currently require following command-line setup instructions. We have not verified a completely terminal-free clean-machine Codex installation.

Open **Setup → Check connection**. If signed out, Modalore opens Codex’s supported browser sign-in. Complete it, return, and check again. Credentials stay managed by Codex. No credentials are stored in a recipe.

Open your saved project and enter “Double enemy health and coin rewards.” Review the request and start. Codex runs inside its own local harness in a separate job workspace. If it needs permission, Modalore shows the actual command or file request. Allow only actions you understand. Stop interrupts the job. A failed, unchanged or invalid output does not replace the last saved recipe.

The supported values are player damage, enemy health and enemy coin rewards. New NPCs, allies, world events, multiplayer and arbitrary code are not supported. A request outside this vocabulary should explain the limitation rather than claim a new feature.

Creation uses your own account’s applicable usage allowance. The app does not estimate money, remaining tokens or unlimited use. An error may mean you need to sign in, update the CLI, wait for an allowance reset, or retry.

## Try the experimental game path

You must own Terraria. Install Terraria and tModLoader through Steam and launch tModLoader normally once so Steam can finish prerequisites. In Modalore, open Setup and detect the game, or select the folder containing `tModLoader.dll` (usually `Steam/steamapps/common/tModLoader`).

Play asks for confirmation because actual game compatibility has not been verified in this development environment. It attempts to build the app’s fixed runtime source using tModLoader, checks the output, checkpoints this profile’s saves, and starts a separate single-player profile. Create a **new character and world**. Keep original saves out of this preview and do not use Host & Play or multiplayer.

“Process started” means only that the operating system started tModLoader. It does not mean the world loaded, the mod worked, or isolation was proven. If build prerequisites are missing, the operation stops with a useful error. The original game install is not a build output location.

## Recover

Close the game before changing or restoring a profile. **Recovery options → Revert recipe** restores the prior saved values and keeps save progress. **Restore save checkpoint** replaces this profile’s Worlds and Players with its checkpoint and can discard later progress. The app asks again before this destructive restore. It does not restore your original Terraria save folder.

Profiles live under `%APPDATA%/Modalore/workshop` in downloaded builds. Development builds may use `%APPDATA%/modalore/workshop`. Keep this folder when uninstalling if you want to retain projects. The application currently has no automatic update mechanism: install a newer preview deliberately and keep an export of important recipes.

## Common fixes

| What you see                   | What to do                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Desktop connection unavailable | Open the downloaded desktop application. A browser preview has no native bridge.                             |
| Codex not found                | Install the official CLI, ensure it is available to your Windows account, restart Modalore, and check again. |
| Signed out                     | Finish the browser sign-in and check the connection again.                                                   |
| Game not found                 | Install tModLoader through Steam, or choose the folder containing its DLL.                                   |
| Build prerequisites missing    | Start tModLoader through Steam once, then retry. Report your tModLoader version if it persists.              |
| Invalid package                | Ask for a fresh export. Do not edit a package’s integrity hash manually.                                     |
| Unsupported change             | Try changing damage, enemy health or coins instead.                                                          |

For bug reports, use [GitHub Issues](https://github.com/JeremySNR/Modalore/issues). Include app/Windows/tModLoader/CLI versions and reproduction steps, not private logs or credentials.
