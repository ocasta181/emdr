import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appVaultStatus,
  createAppVault,
  loadAppDatabase,
  saveAppDatabase,
  unlockAppVaultWithPassword,
  unlockAppVaultWithRecoveryCode
} from "../infrastructure/sqlite/app-store.js";
import { vaultPath } from "../infrastructure/security/vault.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

function databasePath() {
  return vaultPath(app.getPath("userData"));
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
    await window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"));
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
    return appVaultStatus(app.getPath("userData"));
  });

  ipcMain.handle("vault:create", async (_event, password: unknown) => {
    return createAppVault(app.getPath("userData"), String(password));
  });

  ipcMain.handle("vault:unlock-password", async (_event, password: unknown) => {
    await unlockAppVaultWithPassword(app.getPath("userData"), String(password));
    return { ok: true };
  });

  ipcMain.handle("vault:unlock-recovery", async (_event, recoveryCode: unknown) => {
    await unlockAppVaultWithRecoveryCode(app.getPath("userData"), String(recoveryCode));
    return { ok: true };
  });

  ipcMain.handle("db:load", async () => {
    return loadAppDatabase(app.getPath("userData"));
  });

  ipcMain.handle("db:save", async (_event, database: unknown) => {
    await saveAppDatabase(app.getPath("userData"), database as never);
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
