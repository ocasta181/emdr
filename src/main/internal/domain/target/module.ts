import type { MainModule } from "../../../api/types.js";
import { registerTargetIpc } from "./ipc.js";
import type { TargetIpcService } from "./types.js";

export function createTargetModule(service: TargetIpcService): MainModule {
  return {
    Name() {
      return "target";
    },

    Register(registry) {
      registerTargetIpc(registry, service);
    }
  };
}
