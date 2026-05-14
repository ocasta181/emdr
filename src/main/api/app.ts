import path from "node:path";
import { app, ipcMain, session } from "electron";
import { loadAppConfig } from "../internal/lib/config/app-config.js";
import { createMainWindow, hasOpenWindows } from "../internal/lib/electron/window.js";
import { installNetworkGuard } from "../internal/lib/electron/network.js";
import { registerIpcRoutes } from "../internal/lib/ipc/electron.js";
import { Initialize } from "./modules.js";
import { createApiRegistry } from "./registry.js";

export async function Start() {
  const config = loadAppConfig(process.env, process.argv, {
    sqliteTemplatePath: path.join(app.getAppPath(), "dist-electron/sqlite-template.sqlite")
  });
  if (config.userDataPath) {
    app.setPath("userData", config.userDataPath);
  }

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  await app.whenReady();

  const registry = createApiRegistry();
  await Initialize({ routes: registry, config, getUserDataPath: () => userDataPath(config.userDataPath) });

  registerIpcRoutes(ipcMain, registry);
  installNetworkGuard(session.defaultSession, { devServerUrl: config.devServerUrl });

  await createMainWindow({
    devServerUrl: config.devServerUrl,
    useAnimatedUi: config.useAnimatedUi,
    headless: config.headless
  });

  app.on("activate", async () => {
    if (!hasOpenWindows()) {
      await createMainWindow({
        devServerUrl: config.devServerUrl,
        useAnimatedUi: config.useAnimatedUi,
        headless: config.headless
      });
    }
  });
}

function userDataPath(configuredPath: string | undefined) {
  return configuredPath ?? app.getPath("userData");
}
