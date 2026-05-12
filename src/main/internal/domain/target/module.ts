import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerTargetIpc } from "./ipc.js";
import type { TargetIpcService } from "./types.js";

export class TargetRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: TargetIpcService) {
    registerTargetIpc(routes, service);
  }

  Name() {
    return "target";
  }
}
