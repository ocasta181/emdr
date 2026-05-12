import type { ApiRegistry, MainModule } from "../../../api/types.js";
import type { VaultFileDialogs } from "../../lib/electron/vault-file-dialogs.types.js";
import { registerVaultIpc } from "./ipc.js";
import type { VaultIpcService } from "./types.js";

export class VaultRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: VaultIpcService, vaultDialogs: VaultFileDialogs) {
    registerVaultIpc(routes, service, vaultDialogs);
  }

  Name() {
    return "vault";
  }
}
