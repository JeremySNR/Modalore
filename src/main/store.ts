import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  createProfile,
  installRecipe,
  revertVersion,
  readProfile,
} from "./game/adapter.js";
import {
  validateWorkshopRecipe as validateRecipe,
  type WorkshopRecipe as Recipe,
} from "../shared/recipe.js";

type PreviousVersion = { recipe: Recipe; parentHash?: string };
export type ProjectVersion = PreviousVersion & { id: string; savedAt?: string };
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validHash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 30 &&
  Number.isFinite(Date.parse(value));
function previousVersion(value: PreviousVersion): PreviousVersion {
  if (
    !value ||
    typeof value !== "object" ||
    (value.parentHash !== undefined && !validHash(value.parentHash))
  )
    throw new Error("Invalid project history");
  return { recipe: validateRecipe(value.recipe), parentHash: value.parentHash };
}
export type SavedProject = {
  id: string;
  name: string;
  recipe: Recipe;
  updatedAt: string;
  status: string;
  hash: string;
  parentHash?: string;
  checkpoint?: string;
  previousRecipes: PreviousVersion[];
  history: ProjectVersion[];
  archivedAt?: string;
};
export class ProjectStore {
  constructor(readonly root: string) {}
  private file(id: string) {
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
      throw new Error("Invalid project ID");
    return path.join(this.root, "projects", `${id}.json`);
  }
  async init() {
    await fs.mkdir(path.join(this.root, "projects"), { recursive: true });
  }
  async list(): Promise<SavedProject[]> {
    await this.init();
    const list: SavedProject[] = [];
    for (const name of await fs.readdir(path.join(this.root, "projects"))) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      list.push(await this.read(name.slice(0, -5)));
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async read(id: string): Promise<SavedProject> {
    const file = this.file(id),
      stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
      throw new Error("Invalid project record");
    const p = JSON.parse(await fs.readFile(file, "utf8")) as SavedProject;
    if (p.id !== id) throw new Error("Project identity mismatch");
    p.recipe = validateRecipe(p.recipe);
    if (
      !validHash(p.hash) ||
      p.hash !== digest(p.recipe) ||
      (p.parentHash !== undefined && !validHash(p.parentHash)) ||
      !Array.isArray(p.previousRecipes) ||
      p.previousRecipes.length > 30 ||
      typeof p.status !== "string" ||
      !validDate(p.updatedAt) ||
      (p.archivedAt !== undefined && !validDate(p.archivedAt))
    )
      throw new Error("Invalid project history");
    p.name = p.recipe.title;
    p.previousRecipes = p.previousRecipes.map(previousVersion);
    if (
      p.previousRecipes.some(
        (v) => v.recipe.schemaVersion !== p.recipe.schemaVersion,
      )
    )
      throw new Error("Invalid project history");
    // Older releases kept a rollback stack only. Stable IDs make it usable as
    // visible history without changing the record merely by opening the library.
    p.history ??= p.previousRecipes.map((v, index) => ({
      ...v,
      id: digest([index, v]),
    }));
    if (!Array.isArray(p.history) || p.history.length > 30)
      throw new Error("Invalid project history");
    p.history = p.history.map((v) => {
      const previous = previousVersion(v);
      if (
        !validHash(v.id) ||
        (v.savedAt !== undefined && !validDate(v.savedAt))
      )
        throw new Error("Invalid project history");
      return { ...previous, id: v.id, savedAt: v.savedAt };
    });
    if (
      p.history.some((v) => v.recipe.schemaVersion !== p.recipe.schemaVersion)
    )
      throw new Error("Invalid project history");
    if (new Set(p.history.map((v) => v.id)).size !== p.history.length)
      throw new Error("Duplicate project history identity");
    const profile = await readProfile(this.root, id);
    if (profile.recipe && profile.hash !== p.hash) {
      // The atomically saved project record is the commit point. A newer profile pointer
      // with no matching record is an interrupted update, so restore the last committed version.
      await revertVersion(this.root, id, p.hash);
    }
    return p;
  }
  async readActive(id: string) {
    const project = await this.read(id);
    if (project.archivedAt)
      throw new Error(
        "Bring this project back from Archived before editing or playing it.",
      );
    return project;
  }
  private recordHistory(current: SavedProject): ProjectVersion[] {
    return [
      ...current.history,
      {
        id: digest(randomUUID()),
        recipe: current.recipe,
        parentHash: current.parentHash,
        savedAt: current.updatedAt,
      },
    ].slice(-30);
  }
  async save(project: SavedProject) {
    await this.init();
    const file = this.file(project.id),
      temp = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, JSON.stringify(project, null, 2), {
        flag: "wx",
      });
      await fs.rename(temp, file);
    } finally {
      await fs.rm(temp, { force: true });
    }
    return project;
  }
  async create(input: unknown, parentHash?: string) {
    const recipe = validateRecipe(input),
      id = randomUUID();
    await this.init();
    await createProfile(this.root, id);
    const version = await installRecipe(this.root, id, recipe);
    return this.save({
      id,
      name: recipe.title,
      recipe,
      updatedAt: new Date().toISOString(),
      status:
        recipe.schemaVersion === 2
          ? "Recipe checked · play to try"
          : "Recipe checked · game build pending",
      hash: version.hash,
      parentHash,
      previousRecipes: [],
      history: [],
    });
  }
  async update(id: string, input: unknown) {
    const recipe = validateRecipe(input),
      current = await this.readActive(id);
    if (recipe.schemaVersion !== current.recipe.schemaVersion)
      throw new Error("Cannot change a project's game");
    if (JSON.stringify(recipe) === JSON.stringify(current.recipe))
      return current;
    const version = await installRecipe(this.root, id, recipe);
    try {
      return await this.save({
        ...current,
        name: recipe.title,
        recipe,
        hash: version.hash,
        parentHash: current.hash,
        updatedAt: new Date().toISOString(),
        status:
          recipe.schemaVersion === 2
            ? "Recipe checked · play to try"
            : "Recipe checked · game build pending",
        history: this.recordHistory(current),
        previousRecipes: [
          ...current.previousRecipes,
          { recipe: current.recipe, parentHash: current.parentHash },
        ].slice(-30),
      });
    } catch (error) {
      await revertVersion(this.root, id, current.hash);
      throw error;
    }
  }
  async revert(id: string) {
    const current = await this.readActive(id),
      previous = current.previousRecipes.at(-1);
    if (!previous) throw new Error("There is no earlier recipe version yet.");
    const version = await installRecipe(this.root, id, previous.recipe);
    try {
      return await this.save({
        ...current,
        name: previous.recipe.title,
        recipe: previous.recipe,
        hash: version.hash,
        parentHash: previous.parentHash,
        updatedAt: new Date().toISOString(),
        status:
          previous.recipe.schemaVersion === 2
            ? "Earlier recipe restored · play to try"
            : "Earlier recipe restored · rebuild before playing",
        previousRecipes: current.previousRecipes.slice(0, -1),
        history: this.recordHistory(current),
      });
    } catch (error) {
      await revertVersion(this.root, id, current.hash);
      throw error;
    }
  }
  async restoreVersion(id: string, versionId: string) {
    const current = await this.readActive(id);
    if (!validHash(versionId)) throw new Error("Invalid version ID");
    const previous = current.history.find(
      (version) => version.id === versionId,
    );
    if (!previous)
      throw new Error(
        "This version is no longer in the recent history. Refresh the project and try again.",
      );
    if (
      digest(previous.recipe) === current.hash &&
      previous.parentHash === current.parentHash
    )
      return current;
    const version = await installRecipe(this.root, id, previous.recipe);
    try {
      return await this.save({
        ...current,
        name: previous.recipe.title,
        recipe: previous.recipe,
        hash: version.hash,
        parentHash: previous.parentHash,
        updatedAt: new Date().toISOString(),
        status:
          previous.recipe.schemaVersion === 2
            ? "Earlier recipe restored · play to try"
            : "Earlier recipe restored · rebuild before playing",
        history: this.recordHistory(current),
        previousRecipes: [
          ...current.previousRecipes,
          { recipe: current.recipe, parentHash: current.parentHash },
        ].slice(-30),
      });
    } catch (error) {
      await revertVersion(this.root, id, current.hash);
      throw error;
    }
  }
  async archive(id: string) {
    const current = await this.read(id);
    if (current.archivedAt) return current;
    return this.save({ ...current, archivedAt: new Date().toISOString() });
  }
  async unarchive(id: string) {
    const current = await this.read(id);
    const { archivedAt: _archivedAt, ...restored } = current;
    return this.save(restored);
  }
}
