import type { ApiRegistry } from "../../../api/registry.types.js";
import type { SessionRouteService } from "./types.js";

export function registerSessionIpc(registry: ApiRegistry, service: SessionRouteService) {
  registry.handle("session:start", async (payload) => service.start(payload));
  registry.handle("session:update-assessment", async (payload) => service.updateAssessment(payload));
  registry.handle("session:transition-flow", async (payload) => service.transitionFlow(payload));
  registry.handle("session:end", async (payload) => service.end(payload));
}
