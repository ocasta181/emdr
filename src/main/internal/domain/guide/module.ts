import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerGuideIpc } from "./ipc.js";
import type { GuideIpcService } from "./types.js";

export class GuideRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: GuideIpcService) {
    registerGuideIpc(routes, service);
  }

  Name() {
    return "guide";
  }
}
