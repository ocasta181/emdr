import type { ApiRegistry } from "../../../api/registry.types.js";
import type { StimulationSetRouteService } from "./ipc.types.js";

export function registerStimulationSetIpc(registry: ApiRegistry, service: StimulationSetRouteService) {
  registry.handle("stimulation-set:list-by-session", async (payload) => service.listBySession(payload));
  registry.handle("stimulation-set:log", async (payload) => service.log(payload));
}
