import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerStimulationSetIpc } from "./ipc.js";
import type { StimulationSetIpcService } from "./types.js";

export class StimulationSetRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: StimulationSetIpcService) {
    registerStimulationSetIpc(routes, service);
  }

  Name() {
    return "stimulation-set";
  }
}
