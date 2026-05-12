import type { MainModule } from "../../../api/types.js";
import { registerSessionIpc } from "./ipc.js";
import type { SessionIpcService } from "./types.js";

export function createSessionModule(service: SessionIpcService): MainModule {
  return {
    Name() {
      return "session";
    },

    Register(registry) {
      registerSessionIpc(registry, service);
    }
  };
}
