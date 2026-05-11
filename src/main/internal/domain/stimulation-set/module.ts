import type { MainModule } from "../../../api/modules.types.js";
import { registerStimulationSetIpc } from "./ipc.js";
import type { StimulationSetRouteService } from "./types.js";

export function createStimulationSetModule(service: StimulationSetRouteService): MainModule {
  return {
    Name() {
      return "stimulation-set";
    },

    Register(registry) {
      registerStimulationSetIpc(registry, service);
    }
  };
}
