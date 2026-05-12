import type { ApiRegistry } from "../../../api/registry.types.js";
import type { SettingRouteService } from "./ipc.types.js";

export function registerSettingIpc(registry: ApiRegistry, service: SettingRouteService) {
  registry.handle("settings:get", async () => service.get());
  registry.handle("settings:update-bilateral-stimulation", async (payload) =>
    service.updateBilateralStimulation(payload)
  );
}
