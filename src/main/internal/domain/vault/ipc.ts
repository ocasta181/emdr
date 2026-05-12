import type { ApiRegistry } from "../../../api/registry.types.js";
import type { VaultRouteService } from "./ipc.types.js";

export function registerVaultIpc(registry: ApiRegistry, service: VaultRouteService) {
  registry.handle("vault:status", async () => service.status());
  registry.handle("vault:create", async (password) => service.create(password));
  registry.handle("vault:unlock-password", async (password) => service.unlockWithPassword(password));
  registry.handle("vault:unlock-recovery", async (recoveryCode) => service.unlockWithRecoveryCode(recoveryCode));
  registry.handle("vault:export", async () => service.exportVault());
  registry.handle("vault:import", async () => service.importVault());
}
