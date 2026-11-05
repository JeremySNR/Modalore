import type { WorkshopRecipe } from "../shared/recipe";
export type { Recipe, WorkshopRecipe } from "../shared/recipe";
export type Project = {
  id: string;
  name: string;
  recipe: WorkshopRecipe;
  updatedAt?: string;
  status?: string;
  archivedAt?: string;
  history?: Array<{
    id: string;
    recipe: WorkshopRecipe;
    parentHash?: string;
    savedAt?: string;
  }>;
};
export type Snapshot = {
  game?: { found: boolean; path?: string; message?: string };
  luanti?: {
    found: boolean;
    path?: string;
    gameId?: string;
    version?: string;
    message: string;
  };
  codex?: { available: boolean; signedIn?: boolean; message?: string };
  projects?: Project[];
  archivedProjects?: Project[];
};
export type Progress = {
  stage: string;
  message: string;
  detail?: string;
  status?: "running" | "complete" | "error" | "cancelled";
};
export interface ModaloreAPI {
  snapshot(): Promise<Snapshot>;
  setupLuanti(): Promise<Snapshot["luanti"]>;
  detectLuanti(): Promise<Snapshot["luanti"]>;
  pickLuanti(): Promise<Snapshot["luanti"]>;
  detectGame(): Promise<Snapshot["game"]>;
  pickGame(): Promise<Snapshot["game"]>;
  connectCodex(): Promise<Snapshot["codex"]>;
  createProject(recipe: WorkshopRecipe): Promise<Project>;
  updateProject(projectId: string, recipe: WorkshopRecipe): Promise<Project>;
  remix(projectId: string, prompt: string): Promise<Project>;
  cancel(): Promise<void>;
  exportProject(projectId: string): Promise<{ message?: string } | void>;
  importProject(): Promise<Project | null>;
  play(projectId: string): Promise<{ message?: string } | void>;
  restoreVersion(projectId: string, versionId: string): Promise<Project>;
  archiveProject(projectId: string): Promise<Project>;
  unarchiveProject(projectId: string): Promise<Project>;
  restore(projectId: string): Promise<{ message?: string } | void>;
  onProgress(callback: (event: Progress) => void): () => void;
  openExternal(key: "codex" | "tmodloader" | "luanti"): Promise<void>;
}
declare global {
  interface Window {
    modalore?: ModaloreAPI;
  }
}
