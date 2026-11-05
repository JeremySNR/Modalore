/** The complete executable vocabulary of a Modalore recipe. */
export interface Recipe {
  schemaVersion: 1;
  title: string;
  description: string;
  damageMultiplier: number;
  enemyHealthMultiplier: number;
  coinMultiplier: number;
}

export function validateRecipe(input: unknown): Recipe {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Recipe must be an object");
  const r = input as Record<string, unknown>;
  const keys = [
    "schemaVersion",
    "title",
    "description",
    "damageMultiplier",
    "enemyHealthMultiplier",
    "coinMultiplier",
  ];
  if (
    Object.keys(r).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(r, k))
  )
    throw new Error("Unexpected or missing recipe fields");
  if (r.schemaVersion !== 1) throw new Error("Unsupported recipe version");
  if (
    typeof r.title !== "string" ||
    !r.title.trim() ||
    r.title.length > 80 ||
    /[\u0000-\u001f]/.test(r.title)
  )
    throw new Error("Invalid title");
  if (
    typeof r.description !== "string" ||
    r.description.length > 500 ||
    /[\u0000-\u001f]/.test(r.description)
  )
    throw new Error("Invalid description");
  for (const key of [
    "damageMultiplier",
    "enemyHealthMultiplier",
    "coinMultiplier",
  ]) {
    const n = r[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0.5 || n > 3)
      throw new Error(`${key} must be between 0.5 and 3`);
  }
  return {
    schemaVersion: 1,
    title: r.title,
    description: r.description,
    damageMultiplier: r.damageMultiplier as number,
    enemyHealthMultiplier: r.enemyHealthMultiplier as number,
    coinMultiplier: r.coinMultiplier as number,
  };
}

export interface LuantiRecipe {
  schemaVersion: 2;
  game: "luanti-minetest-game";
  title: string;
  description: string;
  speedMultiplier: number;
  jumpMultiplier: number;
  gravityMultiplier: number;
}
export type WorkshopRecipe = Recipe | LuantiRecipe;

export function validateLuantiRecipe(input: unknown): LuantiRecipe {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Recipe must be an object");
  const r = input as Record<string, unknown>;
  const keys = [
    "schemaVersion",
    "game",
    "title",
    "description",
    "speedMultiplier",
    "jumpMultiplier",
    "gravityMultiplier",
  ];
  if (
    Object.keys(r).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(r, k))
  )
    throw new Error("Unexpected or missing recipe fields");
  if (r.schemaVersion !== 2 || r.game !== "luanti-minetest-game")
    throw new Error("Unsupported recipe version or game");
  if (
    typeof r.title !== "string" ||
    !r.title.trim() ||
    r.title.length > 80 ||
    /[\u0000-\u001f]/.test(r.title)
  )
    throw new Error("Invalid title");
  if (
    typeof r.description !== "string" ||
    r.description.length > 500 ||
    /[\u0000-\u001f]/.test(r.description)
  )
    throw new Error("Invalid description");
  for (const key of [
    "speedMultiplier",
    "jumpMultiplier",
    "gravityMultiplier",
  ]) {
    const n = r[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0.5 || n > 3)
      throw new Error(`${key} must be between 0.5 and 3`);
  }
  return {
    schemaVersion: 2,
    game: "luanti-minetest-game",
    title: r.title,
    description: r.description,
    speedMultiplier: r.speedMultiplier as number,
    jumpMultiplier: r.jumpMultiplier as number,
    gravityMultiplier: r.gravityMultiplier as number,
  };
}
export function validateWorkshopRecipe(input: unknown): WorkshopRecipe {
  if (
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (input as Record<string, unknown>).schemaVersion === 2
  )
    return validateLuantiRecipe(input);
  return validateRecipe(input);
}
