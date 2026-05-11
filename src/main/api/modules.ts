import type { MainModule, InitializeOptions } from "./modules.types.js";
import { createLegacyMainModule } from "./legacy-module.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { createVaultModule } from "../internal/domain/vault/module.js";
import { createVaultRouteService } from "./vault-route-service.js";
import { createTargetModule } from "../internal/domain/target/module.js";
import { createTargetRouteService } from "./target-route-service.js";
import { createSettingModule } from "../internal/domain/setting/module.js";
import { createSettingRouteService } from "./setting-route-service.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const vaultDialogs = createVaultFileDialogs();

  return [
    createVaultModule(
      createVaultRouteService({
        getUserDataPath: options.getUserDataPath,
        vaultDialogs
      })
    ),
    createTargetModule(createTargetRouteService({ getUserDataPath: options.getUserDataPath })),
    createSettingModule(createSettingRouteService({ getUserDataPath: options.getUserDataPath })),
    createLegacyMainModule({
      getUserDataPath: options.getUserDataPath
    })
  ];
}
