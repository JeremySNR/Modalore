# Desktop design research

Reviewed 4 November 2026. These are product design references, not claims that Modalore implements every feature in those products.

- [Steam library](https://store.steampowered.com/libraryupdate/?l=english): puts recent games, collections and a direct play action in a persistent library. Modalore uses a persistent left navigation, a compact collection and a clear path from a recipe to Play. We do not copy Steam artwork or social features.
- [Xbox PC library](https://news.xbox.com/en-us/2025/09/15/access-gaming-library-xbox-on-windows-pc-and-handheld/): brings installed games into one library and makes recent titles easy to launch. Its [game management](https://news.xbox.com/en-us/2024/09/25/xbox-update-september-game-bar-compact-mode/) keeps related content and management actions together. Modalore keeps projects in My library and places play, export and recovery alongside a project. The sample collection is explicitly not an installed-game library.
- [GOG Galaxy](https://support.gog.com/hc/en-us/articles/360003935777-I-m-a-GOG-user-what-s-new-for-me-in-GOG-GALAXY?product=gog): documents filtering, sorting, tags and saved views. Modalore starts with the one supported game filter; richer library organization is future work, not a simulated feature.
- [VS Code workbench](https://code.visualstudio.com/docs/editing/getting-started/userinterface): uses a persistent left-side explorer and a main work area. We use the same broad separation for navigation and the studio while keeping the creation controls understandable without developer tooling.
- [Windows typography](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography): recommends Segoe UI Variable, sentence case, regular/semibold weights and a 12/14/20/28/40px hierarchy. Modalore uses system fonts, avoids remotely loaded fonts and keeps headings compact. This also removes a network dependency; it is not a startup benchmark.

## Direction considered

A large editorial serif direction gave discovery visual identity, but used space that should help users find and launch creations, and its small uppercase labels hurt scanning. The selected direction is a compact graphite Windows game launcher: system sans typography, clear rows, neutral surfaces, original labelled concept art and amber reserved for primary actions. It avoids simulated gameplay imagery and social metrics. Native startup and launch performance are measured separately; reducing decorative assets and remote fonts is a design choice, not proof of speed.

## Alternatives and review checklist

- **System Segoe UI Variable / Segoe UI:** selected for Windows familiarity, readable sizes and zero font download. **Inter loaded remotely** was considered for its neutral forms, but adds a network dependency and does not improve the Windows fit enough to justify it. A locally bundled font remains an option if cross-platform testing identifies a need.
- **Editorial serif:** considered for a stronger magazine-like identity, but large headlines and italics consumed working space and reduced scanability. System sans keeps the game and project names prominent.
- **Neutral graphite:** selected to let game artwork and state information stand out while maintaining a consistent tool surface. **Warm olive** was considered but made selection, content and decorative areas compete; amber is retained for primary actions and meaningful emphasis.

Before accepting a screen, check for generic decorative choices that obscure the task: oversized slogans, excessive uppercase tracking, repeated filler cards, invented social proof, gradients or glowing accents without meaning, generic marketing copy, and imagery presented as gameplay when it is not. These are visual review criteria, not claims about how a design was produced. Check keyboard focus, contrast, reduced motion, narrow widths and long names alongside visual composition.
