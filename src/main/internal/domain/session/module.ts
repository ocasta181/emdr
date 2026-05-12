import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerSessionIpc } from "./ipc.js";
import type { SessionIpcService } from "./types.js";

export class SessionRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: SessionIpcService) {
    registerSessionIpc(routes, service);
  }

  Name() {
    return "session";
  }
}
