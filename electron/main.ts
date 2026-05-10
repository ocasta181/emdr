import { app, BrowserWindow, ipcMain, session } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

function databasePath() {
  return path.join(app.getPath("userData"), "emdr-local.db.json");
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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await window.loadFile(path.join(__dirname, "../dist/index.html"));
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

  ipcMain.handle("db:load", async () => {
    const file = databasePath();
    if (!existsSync(file)) {
      return null;
    }

    const contents = await readFile(file, "utf8");
    return JSON.parse(contents);
  });

  ipcMain.handle("db:save", async (_event, database: unknown) => {
    const file = databasePath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(database, null, 2), "utf8");
    return { ok: true, path: file };
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
