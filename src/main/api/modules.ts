import type { MainModule, InitializeOptions } from "./modules.types.js";
import { createLegacyMainModule } from "./legacy-module.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { createVaultModule } from "../internal/domain/vault/module.js";
import { createVaultRouteService } from "./vault-route-service.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const vaultDialogs = createVaultFileDialogs();

  return [
    createVaultModule(
      createVaultRouteService({
        getUserDataPath: options.getUserDataPath,
        vaultDialogs
      })
    ),
    createLegacyMainModule({
      getUserDataPath: options.getUserDataPath
    })
  ];
}
