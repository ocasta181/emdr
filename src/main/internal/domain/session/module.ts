import type { MainModule } from "../../../api/modules.types.js";
import { registerSessionIpc } from "./ipc.js";
import type { SessionRouteService } from "./types.js";

export function createSessionModule(service: SessionRouteService): MainModule {
  return {
    Name() {
      return "session";
    },

    Register(registry) {
      registerSessionIpc(registry, service);
    }
  };
}
