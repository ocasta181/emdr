import type { ApiRegistry } from "../../../api/types.js";
import { stringFrom } from "../../lib/ipc/payload.js";
import type { VaultIpcService } from "./types.js";

export function registerVaultIpc(registry: ApiRegistry, service: VaultIpcService) {
  registry.handle("vault:status", async () => service.status());
  registry.handle("vault:create", async (payload) => service.create(nonEmptyStringFrom(payload, "password")));
  registry.handle("vault:unlock-password", async (payload) =>
    service.unlockWithPassword(nonEmptyStringFrom(payload, "password"))
  );
  registry.handle("vault:unlock-recovery", async (payload) =>
    service.unlockWithRecoveryCode(nonEmptyStringFrom(payload, "recoveryCode"))
  );
  registry.handle("vault:export", async () => service.exportVault());
  registry.handle("vault:import", async () => service.importVault());
}

function nonEmptyStringFrom(payload: unknown, label: string) {
  const value = stringFrom(payload, label);
  if (value.length === 0) {
    throw new Error(`Expected ${label} to be non-empty.`);
  }
  return value;
}
