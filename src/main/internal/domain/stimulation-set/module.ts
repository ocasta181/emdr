import type { MainModule } from "../../../api/types.js";
import { registerStimulationSetIpc } from "./ipc.js";
import type { StimulationSetIpcService } from "./types.js";

export function createStimulationSetModule(service: StimulationSetIpcService): MainModule {
  return {
    Name() {
      return "stimulation-set";
    },

    Register(registry) {
      registerStimulationSetIpc(registry, service);
    }
  };
}
