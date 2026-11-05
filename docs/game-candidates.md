# Installed-game research, 5 November 2026

This is a feasibility comparison based on official publisher and developer documentation. Steam manifests are detection hints, not proof of ownership, installation integrity or launch readiness. Nothing was installed or launched for this investigation.

## Recommendation: investigate KovaaK's scenario authoring first

The developer's [official announcement](https://store.steampowered.com/news/posts/?appids=824270&enddate=1652119547&feed=steam_community_announcements) describes KovaaK's in-game map creator, editing scenarios, and supported Steam deep links for existing scenario names and playlist share codes. Its [official announcements](https://store.steampowered.com/news/posts/?appids=824270&enddate=1613067895&feed=steam_community_announcements) describe scenario controls and the JSON playlist format. This is a plausible low-risk path for a first creation without injection, executable mods or an additional loader. It is a narrower aim-training scenario rather than a general game-mechanic mod.

The developer documents maps created in-game as JSON packed into scenarios; that does **not** establish a supported external writing contract, that Modalore can generate valid playable scenarios, import them automatically, isolate a save, or produce an immutable share release. The official deep link can open a named existing scenario; it does not establish direct loading of a locally generated one. Version behavior and scenario ownership/content rights need verification before attempting automated authoring or sharing. The game has leaderboards and anti-cheat, so stay inside its documented editor and do not inject code or manipulate scores.

The next small verification is an original scenario made through the built-in editor, comparing its saved output and testing a new copy through the game and a fresh profile. Until then, a recipe for target health/speed or other scenario parameters is a proposal, not a verified playable change. Existing Modalore recipes, profile isolation and package format are Terraria-specific: a distinct game-specific recipe and adapter would be required; do not relabel those controls as KovaaK's support. A simple list/launch existing scenario can use documented deep-link design, but is not a complete make-and-share journey.

## Cyberpunk 2077

[CD PROJEKT RED's official guide](https://www.cyberpunk.net/en/modding-support) describes REDmod as a free DLC, its tools, the dedicated `mods` folder, activation and fan-content conditions. REDmod can be powerful, but its tool-dependent build, shared deployment/cache, game-version handling and save recovery need investigation before a safe beginner journey. The official page does not establish that a particular small gameplay tweak has been verified.

## STAR WARS Zero Company

[EA's official FAQ](https://www.ea.com/games/starwars/zero-company/faq) says official mod support is not planned. It is therefore a poor first candidate for a reliable, supported data-mod workflow.

## Evidence limits

Detection and publisher documentation are not a build, game launch or gameplay test. No installed game, original save, score, game file, tool, account or cloud state was modified by this research. Choosing KovaaK's for further investigation is a provisional technical recommendation, not a claim that the current Terraria implementation works with it.
