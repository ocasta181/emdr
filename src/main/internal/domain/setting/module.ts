import type { MainModule } from "../../../api/types.js";
import { registerSettingIpc } from "./ipc.js";
import type { SettingIpcService } from "./types.js";

export function createSettingModule(service: SettingIpcService): MainModule {
  return {
    Name() {
      return "setting";
    },

    Register(registry) {
      registerSettingIpc(registry, service);
    }
  };
}
