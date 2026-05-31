import type { ApiRegistry, MainModule } from "../../../api/types.js";
import { registerSpeechIpc } from "./ipc.js";
import type { SpeechIpcService } from "./types.js";

export class SpeechRoutes implements MainModule {
  constructor(routes: ApiRegistry, service: SpeechIpcService) {
    registerSpeechIpc(routes, service);
  }

  Name() {
    return "speech";
  }
}
