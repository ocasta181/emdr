import type { ApiRegistry, MainModule } from "../../../api/types.js";
import type { TargetService } from "../target/service.js";
import { registerSessionIpc } from "./ipc.js";
import type { SessionService } from "./service.js";

export class SessionRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: SessionService, targets: TargetService) {
    registerSessionIpc(routes, service, targets);
  }

  Name() {
    return "session";
  }
}
