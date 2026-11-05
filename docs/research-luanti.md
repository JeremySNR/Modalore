# A free first game

Checked 5 November 2026. The user clarified that Terraria was an example and is not installed/owned here. A paid prerequisite prevented completing that path, so the next preview offers Luanti with Minetest Game. The experimental Terraria adapter remains intact.

## Sources and choice

- [Official Luanti release 5.18.0](https://github.com/luanti-org/luanti/releases/tag/5.18.0): Windows x64 portable ZIP, released 29 October 2026. GitHub's release metadata supplied the engine asset checksum. The website download page was still showing an older version when checked, so the release asset was used.
- [Windows server support](https://docs.luanti.org/for-server-hosts/setup/windows/) and the downloaded binary's `--help` confirm native client/server and explicit world/config paths. `--go --world` opens a local single-player session. The standard `minetest_game` directory maps to game ID `minetest`.
- [Luanti source/API at 5.18.0](https://github.com/luanti-org/luanti/tree/5.18.0/doc): `set_physics_override`, `get_physics_override`, join and respawn callbacks provide the small execution vocabulary. Speed, jump impulse and gravity are independent multipliers; enemy health and coins would be inappropriate for this game.
- [Pinned Minetest Game source](https://github.com/luanti-org/minetest_game/tree/9e895af6e9feb98332fa1a778001442f5669bc20): maintained peaceful exploration/mining/building game, no built-in mobs. A pinned commit avoids treating a moving branch as compatibility evidence.
- [Game license](https://github.com/luanti-org/minetest_game/blob/9e895af6e9feb98332fa1a778001442f5669bc20/LICENSE.txt): LGPL source and CC BY-SA media, with per-mod credits. Upstream files/credits are retained in the downloaded game. They are not relicensed as Modalore's MIT source or repackaged into a recipe. The engine is downloaded separately from its official release.

## Pin and verify

| Archive | SHA-256 |
| --- | --- |
| `luanti-5.18.0-win64.zip` | `bebce52b58555d8208bf16767d0717788479fef23c35ec8d7bf287774d641835` |
| Minetest Game commit `9e895af6e9feb98332fa1a778001442f5669bc20` ZIP | `aaeddbcc896bd9ac13cd6e6d10afb0c572a865ee1612318536e5272bef22b274` |

The game hash was computed from the downloaded official commit archive. A changed archive fails closed. Setup permits only the required GitHub download hosts, limits archive sizes, rejects path traversal and links, and stages a fresh installation under Modalore's workshop. No firewall change, global installation, account or purchase is required.

## What actually ran

A native Windows 5.18.0 client loaded the pinned game and Modalore's fixed Lua mod in isolated worlds. A local Codex task created a schema-2 recipe and a follow-up changed it. Original and clean-import sessions reported speed 1.5, jump approximately 1.4 and gravity approximately 0.8 on an actual connected player. Exact export/re-export, checkpoint restoration and cancelled creation were checked. The desktop's real setup/download/Play path also ran, including restore after the game wrote its world database. See [Codex journey evidence](luanti-verification.json) and [desktop evidence](luanti-desktop-verification.json).

The initial background-process launch option hid the game window. Switching the interactive launch to a visible process exposed the actual Luanti single-player window. Computer Use could list that window, but screenshot inspection timed out waiting for app approval. Physical movement and gameplay imagery remain unverified; no concept art is presented as game footage.

A loopback connection timed out inside the development sandbox; the same isolated native test passed outside it. This is an environment testing limit, not a reason to change firewall or security settings. Keep user-visible claims tied to the tested engine pair and per-session readback, and test motion, clean-machine onboarding and multiple PC sharing before a stable release.
