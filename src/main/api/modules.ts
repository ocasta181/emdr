import type { MainModule, InitializeOptions } from "./modules.types.js";
import { createLegacyMainModule } from "./legacy-module.js";
import { createDomainServices } from "./domain-services.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { createVaultModule } from "../internal/domain/vault/module.js";
import { createVaultRouteService } from "./vault-route-service.js";
import { createTargetModule } from "../internal/domain/target/module.js";
import { createTargetRouteService } from "./target-route-service.js";
import { createSettingModule } from "../internal/domain/setting/module.js";
import { createSettingRouteService } from "./setting-route-service.js";
import { createStimulationSetModule } from "../internal/domain/stimulation-set/module.js";
import { createStimulationSetRouteService } from "./stimulation-set-route-service.js";
import { createSessionModule } from "../internal/domain/session/module.js";
import { createSessionRouteService } from "./session-route-service.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const vaultDialogs = createVaultFileDialogs();
  const routeServiceOptions = {
    getUserDataPath: options.getUserDataPath,
    createServices: createDomainServices
  };

  return [
    createVaultModule(
      createVaultRouteService({
        getUserDataPath: options.getUserDataPath,
        vaultDialogs
      })
    ),
    createTargetModule(createTargetRouteService(routeServiceOptions)),
    createSessionModule(createSessionRouteService(routeServiceOptions)),
    createSettingModule(createSettingRouteService(routeServiceOptions)),
    createStimulationSetModule(createStimulationSetRouteService(routeServiceOptions)),
    createLegacyMainModule({
      getUserDataPath: options.getUserDataPath
    })
  ];
}
