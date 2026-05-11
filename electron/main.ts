import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appVaultStatus,
  createAppVault,
  exportAppVault,
  importAppVault,
  loadAppDatabase,
  saveAppDatabase,
  unlockAppVaultWithPassword,
  unlockAppVaultWithRecoveryCode
} from "../core/internal/sqlite/app-store.js";
import { VaultService } from "../domain/vault/service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const useAnimatedUi = process.argv.includes("--animated-ui") || process.env.EMDR_LOCAL_UI === "animated";

function databasePath() {
  return new VaultService(userDataPath()).path();
}

function userDataPath() {
  return process.env.EMDR_LOCAL_USER_DATA_PATH ?? app.getPath("userData");
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    title: "EMDR Local",
    backgroundColor: "#171614",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    const devUrl = new URL(process.env.VITE_DEV_SERVER_URL!);
    if (useAnimatedUi) {
      devUrl.searchParams.set("ui", "animated");
    }
    await window.loadURL(devUrl.toString());
  } else {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"), {
      query: useAnimatedUi ? { ui: "animated" } : undefined
    });
  }
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed =
      details.url.startsWith("file:") ||
      details.url.startsWith("devtools:") ||
      (isDev && details.url.startsWith("http://127.0.0.1:5173"));

    callback({ cancel: !allowed });
  });

  ipcMain.handle("vault:status", async () => {
    return appVaultStatus(userDataPath());
  });

  ipcMain.handle("vault:create", async (_event, password: unknown) => {
    return createAppVault(userDataPath(), String(password));
  });

  ipcMain.handle("vault:unlock-password", async (_event, password: unknown) => {
    await unlockAppVaultWithPassword(userDataPath(), String(password));
    return { ok: true };
  });

  ipcMain.handle("vault:unlock-recovery", async (_event, recoveryCode: unknown) => {
    await unlockAppVaultWithRecoveryCode(userDataPath(), String(recoveryCode));
    return { ok: true };
  });

  ipcMain.handle("vault:export", async () => {
    const result = await dialog.showSaveDialog({
      title: "Export Encrypted Data",
      defaultPath: new VaultService(userDataPath()).defaultExportName(),
      filters: [{ name: "EMDR Local Encrypted Data", extensions: ["emdr-vault"] }]
    });

    if (result.canceled || !result.filePath) return { canceled: true };

    await exportAppVault(userDataPath(), result.filePath);
    return { canceled: false, path: result.filePath };
  });

  ipcMain.handle("vault:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Encrypted Data",
      properties: ["openFile"],
      filters: [{ name: "EMDR Local Encrypted Data", extensions: ["emdr-vault"] }]
    });

    if (result.canceled || result.filePaths.length === 0) return { canceled: true };

    const confirmation = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Import", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: "Replace Local Encrypted Data",
      message: "Import encrypted data?",
      detail: "Importing replaces the local encrypted data currently used by this app."
    });

    if (confirmation.response !== 0) return { canceled: true };

    await importAppVault(userDataPath(), result.filePaths[0]);
    return { canceled: false };
  });

  ipcMain.handle("db:load", async () => {
    return loadAppDatabase(userDataPath());
  });

  ipcMain.handle("db:save", async (_event, database: unknown) => {
    await saveAppDatabase(userDataPath(), database as never);
    return { ok: true, path: databasePath() };
  });

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
