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
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Recipe must be an object');
  const r = input as Record<string, unknown>;
  const keys = ['schemaVersion', 'title', 'description', 'damageMultiplier', 'enemyHealthMultiplier', 'coinMultiplier'];
  if (Object.keys(r).length !== keys.length || keys.some(k => !Object.hasOwn(r, k))) throw new Error('Unexpected or missing recipe fields');
  if (r.schemaVersion !== 1) throw new Error('Unsupported recipe version');
  if (typeof r.title !== 'string' || !r.title.trim() || r.title.length > 80 || /[\u0000-\u001f]/.test(r.title)) throw new Error('Invalid title');
  if (typeof r.description !== 'string' || r.description.length > 500 || /[\u0000-\u001f]/.test(r.description)) throw new Error('Invalid description');
  for (const key of ['damageMultiplier', 'enemyHealthMultiplier', 'coinMultiplier']) {
    const n = r[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0.5 || n > 3) throw new Error(`${key} must be between 0.5 and 3`);
  }
  return { schemaVersion: 1, title: r.title, description: r.description, damageMultiplier: r.damageMultiplier as number, enemyHealthMultiplier: r.enemyHealthMultiplier as number, coinMultiplier: r.coinMultiplier as number };
}
