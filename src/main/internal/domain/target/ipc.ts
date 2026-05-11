import type { ApiRegistry } from "../../../api/registry.types.js";
import type { TargetRouteService } from "./types.js";

export function registerTargetIpc(registry: ApiRegistry, service: TargetRouteService) {
  registry.handle("target:list", async () => service.list());
  registry.handle("target:create", async (payload) => service.create(payload));
  registry.handle("target:revise", async (payload) => service.revise(payload));
}
