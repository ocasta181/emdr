import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("emdr", {
  request: (route: string, payload?: unknown) => ipcRenderer.invoke(route, payload),
  subscribe: (topic: string, callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(topic, listener);
    return () => ipcRenderer.off(topic, listener);
  }
});
