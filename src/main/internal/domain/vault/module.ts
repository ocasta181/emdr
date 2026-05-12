import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerVaultIpc } from "./ipc.js";
import type { VaultIpcService } from "./types.js";

export class VaultRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: VaultIpcService) {
    registerVaultIpc(routes, service);
  }

  Name() {
    return "vault";
  }
}
