import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("emdr", {
  vaultStatus: () => ipcRenderer.invoke("vault:status"),
  createVault: (password: string) => ipcRenderer.invoke("vault:create", password),
  unlockWithPassword: (password: string) => ipcRenderer.invoke("vault:unlock-password", password),
  unlockWithRecoveryCode: (recoveryCode: string) => ipcRenderer.invoke("vault:unlock-recovery", recoveryCode),
  exportVault: () => ipcRenderer.invoke("vault:export"),
  importVault: () => ipcRenderer.invoke("vault:import"),
  loadDatabase: () => ipcRenderer.invoke("db:load"),
  saveDatabase: (database: unknown) => ipcRenderer.invoke("db:save", database)
});
