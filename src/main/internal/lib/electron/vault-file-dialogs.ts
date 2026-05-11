import { dialog } from "electron";
import type { VaultFileDialogs } from "./vault-file-dialogs.types.js";

export function createVaultFileDialogs(): VaultFileDialogs {
  return {
    async chooseExportPath(defaultPath: string) {
      const result = await dialog.showSaveDialog({
        title: "Export Encrypted Data",
        defaultPath,
        filters: [{ name: "EMDR Local Encrypted Data", extensions: ["emdr-vault"] }]
      });

      return result.canceled ? undefined : result.filePath;
    },

    async chooseImportPath() {
      const result = await dialog.showOpenDialog({
        title: "Import Encrypted Data",
        properties: ["openFile"],
        filters: [{ name: "EMDR Local Encrypted Data", extensions: ["emdr-vault"] }]
      });

      return result.canceled ? undefined : result.filePaths[0];
    },

    async confirmImportReplacement() {
      const confirmation = await dialog.showMessageBox({
        type: "warning",
        buttons: ["Import", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        title: "Replace Local Encrypted Data",
        message: "Import encrypted data?",
        detail: "Importing replaces the local encrypted data currently used by this app."
      });

      return confirmation.response === 0;
    }
  };
}
