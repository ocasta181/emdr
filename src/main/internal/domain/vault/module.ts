import type { MainModule } from "../../../api/types.js";
import { registerVaultIpc } from "./ipc.js";
import type { VaultIpcService } from "./types.js";

export function createVaultModule(service: VaultIpcService): MainModule {
  return {
    Name() {
      return "vault";
    },

    Register(registry) {
      registerVaultIpc(registry, service);
    }
  };
}
