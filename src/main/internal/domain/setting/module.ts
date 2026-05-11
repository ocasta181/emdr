import type { MainModule } from "../../../api/modules.types.js";
import { registerSettingIpc } from "./ipc.js";
import type { SettingRouteService } from "./types.js";

export function createSettingModule(service: SettingRouteService): MainModule {
  return {
    Name() {
      return "setting";
    },

    Register(registry) {
      registerSettingIpc(registry, service);
    }
  };
}
