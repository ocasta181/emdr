import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("emdr", {
  loadDatabase: () => ipcRenderer.invoke("db:load"),
  saveDatabase: (database: unknown) => ipcRenderer.invoke("db:save", database)
});
