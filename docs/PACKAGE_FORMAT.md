# Recipe package, version 1

A `.modalore.json` file is UTF-8 JSON, at most 64 KiB. It has exactly `format`, `version`, `recipe`, `dependencies`, `supportedVersions`, `parentHash`, `evidence`, and `hash`. No unknown fields, archive paths or executable attachments are accepted.

The recipe has exactly `schemaVersion: 1`, `title`, `description`, `damageMultiplier`, `enemyHealthMultiplier`, and `coinMultiplier`. Titles are 1–80 characters; descriptions are at most 500 characters; control characters are rejected. Multipliers are finite numbers from 0.5 through 3.

`format` is `modalore-recipe`. Dependencies are Terraria, tModLoader, and ModaloreRules. This preview always exports `supportedVersions: "unverified"` and evidence `{schema: true, build: false, launch: false, gameplay: false}`. It never trusts a package's claim of successful gameplay.

Two identities serve different purposes:

- **Recipe identity:** SHA-256 of compact JSON returned by `validateRecipe`, in the schema's fixed key order. `parentHash` is the prior recipe's identity, or null. A remix creates this attribution; import does not create a new remix.
- **Package identity:** `hash` is SHA-256 of compact JSON containing all fields except `hash`, in the order emitted by `exportPackage`. It covers the recipe, dependencies, evidence and parent identity. The pretty-printed file itself need not have identical whitespace.

Repeated exports of an unchanged version produce the same bytes. A clean import and re-export preserves the same package identity. Reverting restores the earlier recipe and its earlier ancestry. Hashes establish byte consistency, not authorship, safety or authenticity. There is no signing service or online registry in this release.

A future web route should identify the immutable package hash, show dependencies and evidence, and offer a download. It must not imply a live share link exists before a real publishing backend is implemented. Package format changes need explicit versioning and migration tests.
