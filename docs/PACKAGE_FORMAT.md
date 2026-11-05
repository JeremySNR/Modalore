# Recipe packages, versions 1 and 2

A `.modalore.json` file is UTF-8 JSON, at most 64 KiB. It has exactly `format`, `version`, `recipe`, `dependencies`, `supportedVersions`, `parentHash`, `evidence`, and `hash`. No unknown fields, archive paths or executable attachments are accepted.

Version 1 retains the Terraria recipe with exactly `schemaVersion: 1`, `title`, `description`, `damageMultiplier`, `enemyHealthMultiplier`, and `coinMultiplier`. Version 2 uses exactly `schemaVersion: 2`, `game: "luanti-minetest-game"`, `title`, `description`, `speedMultiplier`, `jumpMultiplier`, and `gravityMultiplier`. Titles are 1–80 characters; descriptions are at most 500 characters; control characters are rejected. Multipliers are finite numbers from 0.5 through 3. Fields cannot be mixed across games.

`format` is `modalore-recipe`. Version 1 dependencies are Terraria, tModLoader, and ModaloreRules with `supportedVersions: "unverified"`. Version 2 dependencies are Luanti, Minetest Game, and ModaloreMovement, with `supportedVersions: "Luanti 5.18.0; Minetest Game 9e895af6e9feb98332fa1a778001442f5669bc20"`. Both export evidence `{schema: true, build: false, launch: false, gameplay: false}`. A local session's readback is not transferred as a claim that the recipient's computer has played the package.

Two identities serve different purposes:

- **Recipe identity:** SHA-256 of compact JSON returned by `validateRecipe`, in the schema's fixed key order. `parentHash` is the prior recipe's identity, or null. A remix creates this attribution; import does not create a new remix.
- **Package identity:** `hash` is SHA-256 of compact JSON containing all fields except `hash`, in the order emitted by `exportPackage`. It covers the recipe, dependencies, evidence and parent identity. The pretty-printed file itself need not have identical whitespace.

Repeated exports of an unchanged version produce the same bytes. A clean import and re-export preserves the same package identity. Reverting restores the earlier recipe and its earlier ancestry. Hashes establish byte consistency, not authorship, safety or authenticity. There is no signing service or online registry in this release.

A future web route should identify the immutable package hash, show dependencies and evidence, and offer a download. It must not imply a live share link exists before a real publishing backend is implemented. Package format changes need explicit versioning and migration tests.
