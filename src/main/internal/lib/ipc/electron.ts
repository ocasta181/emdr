import type { IpcMain } from "electron";
import type { ApiRegistry } from "../../../api/types.js";

export function registerIpcRoutes(ipcMain: IpcMain, registry: ApiRegistry) {
  for (const route of registry.routes()) {
    ipcMain.handle(route, async (_event, payload) => registry.dispatch(route, payload));
  }
}
