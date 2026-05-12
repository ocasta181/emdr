import {
  appVaultStatus,
  createAppVault,
  exportAppVault,
  importAppVault,
  unlockAppVaultWithPassword,
  unlockAppVaultWithRecoveryCode
} from "../internal/lib/store/sqlite/app-store.js";
import { VaultService } from "../../../domain/vault/service.js";
import type { VaultRouteService } from "../internal/domain/vault/ipc.types.js";
import type { VaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.types.js";

export function createVaultRouteService(options: {
  getUserDataPath: () => string;
  vaultDialogs: VaultFileDialogs;
}): VaultRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    status() {
      return appVaultStatus(userDataPath());
    },

    create(password) {
      return createAppVault(userDataPath(), String(password));
    },

    async unlockWithPassword(password) {
      await unlockAppVaultWithPassword(userDataPath(), String(password));
      return { ok: true };
    },

    async unlockWithRecoveryCode(recoveryCode) {
      await unlockAppVaultWithRecoveryCode(userDataPath(), String(recoveryCode));
      return { ok: true };
    },

    async exportVault() {
      const destinationPath = await options.vaultDialogs.chooseExportPath(
        new VaultService(userDataPath()).defaultExportName()
      );
      if (!destinationPath) return { canceled: true };

      await exportAppVault(userDataPath(), destinationPath);
      return { canceled: false, path: destinationPath };
    },

    async importVault() {
      const sourcePath = await options.vaultDialogs.chooseImportPath();
      if (!sourcePath) return { canceled: true };

      const confirmed = await options.vaultDialogs.confirmImportReplacement();
      if (!confirmed) return { canceled: true };

      await importAppVault(userDataPath(), sourcePath);
      return { canceled: false };
    }
  };
}
