import { app, ipcMain, session } from "electron";
import { createMainWindow, hasOpenWindows } from "../internal/lib/electron/window.js";
import { installNetworkGuard } from "../internal/lib/electron/network.js";
import { registerIpcRoutes } from "../internal/lib/ipc/electron.js";
import { Initialize } from "./modules.js";
import { createApiRegistry } from "./registry.js";

const useAnimatedUi = process.argv.includes("--animated-ui") || process.env.EMDR_LOCAL_UI === "animated";

export async function Start() {
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  await app.whenReady();

  const registry = createApiRegistry();
  await Initialize({ routes: registry, getUserDataPath: userDataPath });

  registerIpcRoutes(ipcMain, registry);
  installNetworkGuard(session.defaultSession, { devServerUrl: process.env.VITE_DEV_SERVER_URL });

  await createMainWindow({ devServerUrl: process.env.VITE_DEV_SERVER_URL, useAnimatedUi });

  app.on("activate", async () => {
    if (!hasOpenWindows()) {
      await createMainWindow({ devServerUrl: process.env.VITE_DEV_SERVER_URL, useAnimatedUi });
    }
  });
}

function userDataPath() {
  return process.env.EMDR_LOCAL_USER_DATA_PATH ?? app.getPath("userData");
}
