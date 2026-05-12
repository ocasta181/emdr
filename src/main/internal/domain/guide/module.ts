import type { MainModule } from "../../../api/types.js";
import { registerGuideIpc } from "./ipc.js";
import type { GuideIpcService } from "./types.js";

export function createGuideModule(service: GuideIpcService): MainModule {
  return {
    Name() {
      return "guide";
    },

    Register(registry) {
      registerGuideIpc(registry, service);
    }
  };
}
