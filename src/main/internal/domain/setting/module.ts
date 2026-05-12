import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerSettingIpc } from "./ipc.js";
import type { SettingIpcService } from "./types.js";

export class SettingRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: SettingIpcService) {
    registerSettingIpc(routes, service);
  }

  Name() {
    return "setting";
  }
}
