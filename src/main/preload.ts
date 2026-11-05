import { contextBridge, ipcRenderer } from "electron";
import type { ModaloreAPI, Progress } from "../renderer/api.js";
const api: ModaloreAPI = {
  snapshot: () => ipcRenderer.invoke("modalore:snapshot"),
  setupLuanti: () => ipcRenderer.invoke("modalore:setupLuanti"),
  detectLuanti: () => ipcRenderer.invoke("modalore:detectLuanti"),
  pickLuanti: () => ipcRenderer.invoke("modalore:pickLuanti"),
  detectGame: () => ipcRenderer.invoke("modalore:detectGame"),
  pickGame: () => ipcRenderer.invoke("modalore:pickGame"),
  connectCodex: () => ipcRenderer.invoke("modalore:connectCodex"),
  createProject: (recipe) =>
    ipcRenderer.invoke("modalore:createProject", recipe),
  updateProject: (id, recipe) =>
    ipcRenderer.invoke("modalore:updateProject", id, recipe),
  remix: (id, prompt) => ipcRenderer.invoke("modalore:remix", id, prompt),
  cancel: () => ipcRenderer.invoke("modalore:cancel"),
  exportProject: (id) => ipcRenderer.invoke("modalore:exportProject", id),
  importProject: () => ipcRenderer.invoke("modalore:importProject"),
  play: (id) => ipcRenderer.invoke("modalore:play", id),
  restoreVersion: (id, versionId) =>
    ipcRenderer.invoke("modalore:restoreVersion", id, versionId),
  archiveProject: (id) => ipcRenderer.invoke("modalore:archiveProject", id),
  unarchiveProject: (id) => ipcRenderer.invoke("modalore:unarchiveProject", id),
  restore: (id) => ipcRenderer.invoke("modalore:restore", id),
  openExternal: (key) => ipcRenderer.invoke("modalore:openExternal", key),
  onProgress: (callback) => {
    const listener = (_event: unknown, progress: Progress) =>
      callback(progress);
    ipcRenderer.on("modalore:progress", listener);
    return () => ipcRenderer.removeListener("modalore:progress", listener);
  },
};
contextBridge.exposeInMainWorld("modalore", api);
