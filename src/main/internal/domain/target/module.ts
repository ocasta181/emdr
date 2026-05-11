import type { MainModule } from "../../../api/modules.types.js";
import { registerTargetIpc } from "./ipc.js";
import type { TargetRouteService } from "./types.js";

export function createTargetModule(service: TargetRouteService): MainModule {
  return {
    Name() {
      return "target";
    },

    Register(registry) {
      registerTargetIpc(registry, service);
    }
  };
}
