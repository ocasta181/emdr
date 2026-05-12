import type { ApiRegistry } from "../../../api/types.js";
import type { VaultFileDialogs } from "../../lib/electron/vault-file-dialogs.types.js";
import { stringFrom } from "../../lib/ipc/payload.js";
import type { VaultIpcService } from "./types.js";

export function registerVaultIpc(registry: ApiRegistry, service: VaultIpcService, vaultDialogs: VaultFileDialogs) {
  registry.handle("vault:status", async () => service.status());
  registry.handle("vault:create", async (payload) => service.create(nonEmptyStringFrom(payload, "password")));
  registry.handle("vault:unlock-password", async (payload) =>
    service.unlockWithPassword(nonEmptyStringFrom(payload, "password"))
  );
  registry.handle("vault:unlock-recovery", async (payload) =>
    service.unlockWithRecoveryCode(nonEmptyStringFrom(payload, "recoveryCode"))
  );
  registry.handle("vault:export", async () => {
    const destinationPath = await vaultDialogs.chooseExportPath(service.defaultExportName());
    if (!destinationPath) return { canceled: true } as const;

    await service.exportVault(destinationPath);
    return { canceled: false, path: destinationPath } as const;
  });
  registry.handle("vault:import", async () => {
    const sourcePath = await vaultDialogs.chooseImportPath();
    if (!sourcePath) return { canceled: true };

    const confirmed = await vaultDialogs.confirmImportReplacement();
    if (!confirmed) return { canceled: true };

    await service.importVault(sourcePath);
    return { canceled: false };
  });
}

function nonEmptyStringFrom(payload: unknown, label: string) {
  const value = stringFrom(payload, label);
  if (value.length === 0) {
    throw new Error(`Expected ${label} to be non-empty.`);
  }
  return value;
}
