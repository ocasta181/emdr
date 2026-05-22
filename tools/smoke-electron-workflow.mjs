import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { Initialize } from "../dist-electron/src/main/api/modules.js";
import { createApiRegistry } from "../dist-electron/src/main/api/registry.js";
import { registerIpcRoutes } from "../dist-electron/src/main/internal/lib/ipc/electron.js";
import { installPermissionPolicy } from "../dist-electron/src/main/internal/lib/electron/permissions.js";
import {
  createSqliteDatabase,
  exportSqliteDatabase
} from "../dist-electron/src/main/internal/lib/store/sqlite/connection.js";
import { up as initialSchema } from "../dist-electron/src/main/internal/lib/store/sqlite/migrations/0001_initial_schema.js";
import { createRunContext, recordCurrentProcess } from "./qa-run-context.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let phase = "startup";
const smokeTimeout = setTimeout(() => {
  console.error(`Electron workflow smoke timed out during: ${phase}`);
  app.exit(1);
}, 30000);

app.commandLine.appendSwitch("disable-gpu");
app.disableHardwareAcceleration();

void main().catch((error) => {
  console.error(error);
  app.exit(1);
});

async function main() {
  const runContext = await createRunContext({ root: repoRoot });
  await recordCurrentProcess(runContext, "app");
  app.setPath("userData", runContext.electronUserDataPath);
  const artifactDir = path.join(runContext.runDir, "artifacts");
  await mkdir(artifactDir, { recursive: true });

  try {
    phase = "create template";
    const templatePath = path.join(artifactDir, "template.sqlite");
    const templateDb = await createSqliteDatabase();
    initialSchema(templateDb);
    await writeFile(templatePath, exportSqliteDatabase(templateDb));

    phase = "app ready";
    await app.whenReady();

    phase = "register routes";
    const routes = createApiRegistry();
    await Initialize({
      routes,
      config: { sqliteTemplatePath: templatePath },
      getUserDataPath: () => runContext.electronUserDataPath
    });
    registerIpcRoutes(ipcMain, routes);
    installPermissionPolicy(session.defaultSession, {});

    phase = "create window";
    const window = new BrowserWindow({
      show: false,
      width: 1124,
      height: 768,
      webPreferences: {
        preload: path.join(repoRoot, "dist-electron/electron/preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    phase = "load renderer";
    await window.loadFile(path.join(repoRoot, "dist/index.html"), { query: { ui: "animated" } });
    phase = "wait create password";
    await waitForText(window, "Create Password");

    phase = "setup vault";
    await setControlValue(window, 0, "passphrase-123", "input");
    await setControlValue(window, 1, "passphrase-123", "input");
    await clickButton(window, "Set Up");
    await waitForText(window, "Recovery Key");
    await expectButtonPresent(window, "Continue", false);
    await clickCheckbox(window, "I saved this recovery key.");
    await expectButtonPresent(window, "Continue", true);
    await clickButton(window, "Continue");
    await waitForText(window, "I can help identify a target");
    await expectText(window, "Open Targets", false);
    await expectButtonPresent(window, "Start Voice", false);
    await expectButtonPresent(window, "Replay Guide", false);
    await expectButtonPresent(window, "Use Keyboard", false);
    await waitForText(window, "Tell the guide");

    phase = "create guided target";
    await expectButtonPresent(window, "Start Set", false);
    await setFieldByLabel(window, "Tell the guide", "Electron workflow target");
    await clickButton(window, "Send");
    await waitForText(window, "Review proposed target");
    await setFieldByLabel(window, "Negative cognition", "I am stuck");
    await setFieldByLabel(window, "Positive cognition", "I can move");
    await clickButton(window, "Apply target draft");
    await waitForText(window, "Electron workflow target");
    await waitForButtonPresent(window, "Start Set", true);
    await setFieldByLabel(window, "Tell the guide", "Second workflow target");
    await clickButton(window, "Send");
    await waitForText(window, "Review proposed target");
    await clickButton(window, "Apply target draft");
    await waitForText(window, "Second workflow target");
    await waitForButtonPresent(window, "Start Set", true);

    phase = "start guide-prioritized stimulation";
    await clickButton(window, "Start Set");
    await waitForText(window, "Pause Set");
    await expectStimulationBackdropBlank(window);
    phase = "keyboard pauses stimulation";
    await pressKey(window, "A");
    await waitForText(window, "1 set logged");
    await waitForText(window, "Begin closure");
    phase = "guide proposal logs stimulation";
    await clickButton(window, "Continue set");
    await waitForText(window, "Pause Set");
    await clickButton(window, "Guide");
    await waitForText(window, "2 sets logged");
    phase = "begin closure";
    await clickButton(window, "Begin closure");
    await waitForText(window, "Closure");
    phase = "request review";
    await clickButton(window, "Request review");
    await waitForText(window, "Review");
    await expectText(window, "Start Set", false);
    await setFieldByLabel(window, "Final SUD", "2");
    phase = "end session";
    await clickButton(window, "End session");
    await waitForText(window, "I can help choose among 2 active targets");
    phase = "review history";
    await clickButton(window, "Close");
    await clickRoomHistory(window);
    await waitForText(window, "SUD end 2");

    phase = "export vault";
    const exportPath = path.join(artifactDir, "workflow-export.emdr-vault");
    installVaultDialogStubs(exportPath);
    await clickButton(window, "Close");
    await clickRoomSettings(window);
    await waitForText(window, "Ball Settings");
    await clickButton(window, "Export");
    await waitForFile(exportPath);

    phase = "import vault";
    await clickButton(window, "Import");
    await waitForText(window, "Unlock");

    phase = "unlock imported vault";
    await setControlValue(window, 0, "passphrase-123", "input");
    await clickButton(window, "Unlock");
    await waitForText(window, "I can help choose among 2 active targets");

    phase = "start imported active session";
    await clickButton(window, "Start Set");
    await waitForText(window, "Session in progress");
    await waitForText(window, "Pause Set");
    await expectStimulationBackdropBlank(window);

    phase = "export active vault";
    const activeExportPath = path.join(artifactDir, "active-workflow-export.emdr-vault");
    installVaultDialogStubs(activeExportPath);
    await clickButton(window, "Ball settings");
    await waitForText(window, "Ball Settings");
    await clickButton(window, "Export");
    await waitForFile(activeExportPath);

    phase = "import active vault";
    await clickButton(window, "Import");
    await waitForText(window, "Unlock");

    phase = "unlock active import";
    await setControlValue(window, 0, "passphrase-123", "input");
    await clickButton(window, "Unlock");
    await waitForText(window, "Session in progress");
    await waitForText(window, "Preparation");
    await expectText(window, "Pause Set", false);
    await expectText(window, "Ball Settings", false);

    phase = "lock from settings";
    await clickButton(window, "Close");
    await clickRoomSettings(window);
    await waitForText(window, "Ball Settings");
    await clickButton(window, "Lock");
    await waitForText(window, "Unlock");
    await waitForText(window, "Encrypted data locked.");

    process.stdout.write("Electron workflow smoke passed.\n");
  } finally {
    clearTimeout(smokeTimeout);
    app.quit();
  }
}

function installVaultDialogStubs(exportPath) {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportPath });
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportPath] });
  dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
}

async function clickButton(window, label) {
  await window.webContents.executeJavaScript(
    `(${domHelpers})().clickButton(${JSON.stringify(label)})`,
    true
  );
}

async function clickRoomSettings(window) {
  await clickRoomPoint(window, 0.86, 0.6);
}

async function clickRoomHistory(window) {
  await clickRoomPoint(window, 0.68, 0.75);
}

async function clickRoomPoint(window, xFraction, yFraction) {
  const point = await window.webContents.executeJavaScript(
    `(() => {
      const room = document.querySelector(".roomScene");
      if (!(room instanceof HTMLElement)) throw new Error("Room scene not found.");
      const rect = room.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width * ${JSON.stringify(xFraction)}),
        y: Math.round(rect.top + rect.height * ${JSON.stringify(yFraction)})
      };
    })()`,
    true
  );

  window.webContents.focus();
  window.webContents.sendInputEvent({ type: "mouseMove", x: point.x, y: point.y });
  window.webContents.sendInputEvent({ type: "mouseDown", x: point.x, y: point.y, button: "left", clickCount: 1 });
  window.webContents.sendInputEvent({ type: "mouseUp", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function pressKey(window, keyCode) {
  window.webContents.focus();
  window.webContents.sendInputEvent({ type: "keyDown", keyCode });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function expectStimulationBackdropBlank(window) {
  const samples = await window.webContents.capturePage().then((image) => {
    const size = image.getSize();
    const bitmap = image.toBitmap();
    const points = [
      { x: Math.floor(size.width * 0.78), y: Math.floor(size.height * 0.19) },
      { x: Math.floor(size.width * 0.5), y: Math.floor(size.height * 0.84) }
    ];

    return points.map((point) => sampleBrightness(bitmap, size.width, point.x, point.y));
  });

  const visibleBackdrop = samples.every((brightness) => brightness < 12);
  if (!visibleBackdrop) {
    throw new Error(`Expected blank stimulation backdrop, got brightness samples ${samples.join(", ")}.`);
  }
}

function sampleBrightness(bitmap, width, x, y) {
  const offset = (y * width + x) * 4;
  return (bitmap[offset] + bitmap[offset + 1] + bitmap[offset + 2]) / 3;
}

async function setControlValue(window, index, value, selector) {
  await window.webContents.executeJavaScript(
    `(${domHelpers})().setControlValue(${JSON.stringify(selector)}, ${index}, ${JSON.stringify(value)})`,
    true
  );
}

async function setFieldByLabel(window, label, value) {
  await window.webContents.executeJavaScript(
    `(${domHelpers})().setFieldByLabel(${JSON.stringify(label)}, ${JSON.stringify(value)})`,
    true
  );
}

async function expectButtonPresent(window, label, expected) {
  const present = await window.webContents.executeJavaScript(
    `(${domHelpers})().hasButton(${JSON.stringify(label)})`,
    true
  );
  if (present !== expected) {
    throw new Error(`Expected button "${label}" present=${expected}, got ${present}.`);
  }
}

async function waitForButtonPresent(window, label, expected, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const present = await window.webContents.executeJavaScript(
      `(${domHelpers})().hasButton(${JSON.stringify(label)})`,
      true
    );
    if (present === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const body = await window.webContents.executeJavaScript("document.body.innerText", true);
  throw new Error(`Timed out waiting for button "${label}" present=${expected}. Body text: ${body}`);
}

async function clickCheckbox(window, label) {
  await window.webContents.executeJavaScript(
    `(${domHelpers})().clickCheckbox(${JSON.stringify(label)})`,
    true
  );
}

async function waitForText(window, text, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = await window.webContents.executeJavaScript(
      `document.body.innerText.includes(${JSON.stringify(text)})`,
      true
    );
    if (found) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const body = await window.webContents.executeJavaScript("document.body.innerText", true);
  throw new Error(`Timed out waiting for text "${text}". Body text: ${body}`);
}

async function expectText(window, text, expected) {
  const found = await window.webContents.executeJavaScript(
    `document.body.innerText.includes(${JSON.stringify(text)})`,
    true
  );
  if (found !== expected) {
    throw new Error(`Expected text "${text}" present=${expected}, got ${found}.`);
  }
}

async function waitForFile(filePath, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Timed out waiting for file ${filePath}.`);
}

function domHelpers() {
  const normalize = (value) => value.replace(/\s+/g, " ").trim();

  function buttonByLabel(label) {
    const button = [...document.querySelectorAll("button")].find((item) => normalize(item.textContent ?? "") === label);
    if (!button) {
      throw new Error(`Button not found: ${label}`);
    }
    return button;
  }

  function setNativeValue(control, value) {
    const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return {
    clickButton(label) {
      buttonByLabel(label).click();
    },

    hasButton(label) {
      return [...document.querySelectorAll("button")].some((item) => normalize(item.textContent ?? "") === label);
    },

    clickCheckbox(label) {
      const fieldLabel = [...document.querySelectorAll("label")].find((item) =>
        normalize(item.textContent ?? "") === label
      );
      const control = fieldLabel?.querySelector("input");
      if (!(control instanceof HTMLInputElement) || control.type !== "checkbox") {
        throw new Error(`Checkbox not found: ${label}`);
      }
      control.click();
    },

    setControlValue(selector, index, value) {
      const control = document.querySelectorAll(selector)[index];
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
        throw new Error(`Control not found: ${selector}[${index}]`);
      }
      setNativeValue(control, value);
    },

    setFieldByLabel(label, value) {
      const fieldLabel = [...document.querySelectorAll("label")].find((item) =>
        normalize(item.textContent ?? "").startsWith(label)
      );
      const control = fieldLabel?.querySelector("input, textarea");
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
        throw new Error(`Field not found: ${label}`);
      }
      setNativeValue(control, value);
    }
  };
}
