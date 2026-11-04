import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createProfile, installRecipe } from './game/adapter.js';
import { validateRecipe, type Recipe } from '../shared/recipe.js';

export type SavedProject = { id: string; name: string; recipe: Recipe; updatedAt: string; status: string; hash: string; parentHash?: string; checkpoint?: string; previousRecipes: Recipe[] };
export class ProjectStore {
  constructor(readonly root: string) {}
  private file(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid project ID');
    return path.join(this.root, 'projects', `${id}.json`);
  }
  async init() { await fs.mkdir(path.join(this.root, 'projects'), { recursive: true }); }
  async list(): Promise<SavedProject[]> {
    await this.init(); const list: SavedProject[] = [];
    for (const name of await fs.readdir(path.join(this.root, 'projects'))) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      list.push(await this.read(name.slice(0, -5)));
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async read(id: string): Promise<SavedProject> {
    const file = this.file(id), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('Invalid project record');
    const p = JSON.parse(await fs.readFile(file, 'utf8')) as SavedProject;
    if (p.id !== id) throw new Error('Project identity mismatch');
    p.recipe = validateRecipe(p.recipe); return p;
  }
  async save(project: SavedProject) {
    await this.init(); const file = this.file(project.id), temp = `${file}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temp, JSON.stringify(project, null, 2), { flag: 'wx' }); await fs.rename(temp, file); }
    finally { await fs.rm(temp, { force: true }); }
    return project;
  }
  async create(input: unknown, parentHash?: string) {
    const recipe = validateRecipe(input), id = randomUUID();
    await this.init(); await createProfile(this.root, id);
    const version = await installRecipe(this.root, id, recipe);
    return this.save({ id, name: recipe.title, recipe, updatedAt: new Date().toISOString(), status: 'Recipe checked · game build pending', hash: version.hash, parentHash, previousRecipes: [] });
  }
  async update(id: string, input: unknown) {
    const recipe = validateRecipe(input), current = await this.read(id);
    const version = await installRecipe(this.root, id, recipe);
    return this.save({ ...current, name: recipe.title, recipe, hash: version.hash, parentHash: current.hash, updatedAt: new Date().toISOString(), status: 'Recipe checked · game build pending', previousRecipes: [...current.previousRecipes, current.recipe].slice(-30) });
  }
  async revert(id: string) {
    const current = await this.read(id), previous = current.previousRecipes.at(-1);
    if (!previous) throw new Error('There is no earlier recipe version yet.');
    const version = await installRecipe(this.root, id, previous);
    return this.save({ ...current, name: previous.title, recipe: previous, hash: version.hash, updatedAt: new Date().toISOString(), status: 'Earlier recipe restored · rebuild before playing', previousRecipes: current.previousRecipes.slice(0, -1) });
  }
}
