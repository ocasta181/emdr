import {
  appVaultStatus,
  createAppVault,
  exportAppVault,
  importAppVault,
  loadAppDatabase,
  saveAppDatabase,
  unlockAppVaultWithPassword,
  unlockAppVaultWithRecoveryCode
} from "../../../core/internal/sqlite/app-store.js";
import { VaultService } from "../../../domain/vault/service.js";
import type { MainModule } from "./modules.types.js";
import type { LegacyMainModuleOptions } from "./legacy-module.types.js";

export function createLegacyMainModule(options: LegacyMainModuleOptions): MainModule {
  const userDataPath = options.getUserDataPath;

  return {
    Name() {
      return "legacy-main";
    },

    Register(registry) {
      registry.handle("vault:status", async () => appVaultStatus(userDataPath()));

      registry.handle("vault:create", async (password) => {
        return createAppVault(userDataPath(), String(password));
      });

      registry.handle("vault:unlock-password", async (password) => {
        await unlockAppVaultWithPassword(userDataPath(), String(password));
        return { ok: true };
      });

      registry.handle("vault:unlock-recovery", async (recoveryCode) => {
        await unlockAppVaultWithRecoveryCode(userDataPath(), String(recoveryCode));
        return { ok: true };
      });

      registry.handle("vault:export", async () => {
        const destinationPath = await options.vaultDialogs.chooseExportPath(
          new VaultService(userDataPath()).defaultExportName()
        );
        if (!destinationPath) return { canceled: true };

        await exportAppVault(userDataPath(), destinationPath);
        return { canceled: false, path: destinationPath };
      });

      registry.handle("vault:import", async () => {
        const sourcePath = await options.vaultDialogs.chooseImportPath();
        if (!sourcePath) return { canceled: true };

        const confirmed = await options.vaultDialogs.confirmImportReplacement();
        if (!confirmed) return { canceled: true };

        await importAppVault(userDataPath(), sourcePath);
        return { canceled: false };
      });

      registry.handle("db:load", async () => {
        return loadAppDatabase(userDataPath());
      });

      registry.handle("db:save", async (database) => {
        await saveAppDatabase(userDataPath(), database as never);
        return { ok: true, path: new VaultService(userDataPath()).path() };
      });
    }
  };
}
