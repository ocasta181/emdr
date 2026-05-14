import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MainWindowOptions } from "./window.types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distElectronRoot = path.resolve(__dirname, "../../../../../");
const projectRoot = path.resolve(distElectronRoot, "..");

export async function createMainWindow(options: MainWindowOptions) {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    show: !options.headless,
    title: "EMDR Local",
    backgroundColor: "#171614",
    webPreferences: {
      preload: path.join(distElectronRoot, "electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (options.devServerUrl) {
    const devUrl = new URL(options.devServerUrl);
    if (options.useAnimatedUi) {
      devUrl.searchParams.set("ui", "animated");
    }
    await window.loadURL(devUrl.toString());
  } else {
    await window.loadFile(path.join(projectRoot, "dist/index.html"), {
      query: options.useAnimatedUi ? { ui: "animated" } : undefined
    });
  }
}

export function hasOpenWindows() {
  return BrowserWindow.getAllWindows().length > 0;
}
