import type { MainModule } from "../../../api/modules.types.js";
import { registerVaultIpc } from "./ipc.js";
import type { VaultRouteService } from "./ipc.types.js";

export function createVaultModule(service: VaultRouteService): MainModule {
  return {
    Name() {
      return "vault";
    },

    Register(registry) {
      registerVaultIpc(registry, service);
    }
  };
}
