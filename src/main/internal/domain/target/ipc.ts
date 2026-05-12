import type { ApiRegistry } from "../../../api/types.js";
import {
  optionalNumberInRange,
  optionalString,
  optionalStringEnum,
  recordFrom,
  requiredRecord,
  requiredString
} from "../../lib/ipc/payload.js";
import type { TargetStatus } from "./entity.js";
import type { TargetDraft, TargetIpcService, TargetRevisionRequest } from "./types.js";

const targetStatuses = ["active", "completed", "deferred"] as const satisfies readonly TargetStatus[];
const disturbanceRange = { min: 0, max: 10 };

export function registerTargetIpc(registry: ApiRegistry, service: TargetIpcService) {
  registry.handle("target:list", async () => service.listCurrentTargets());
  registry.handle("target:list-all", async () => service.listAllTargets());
  registry.handle("target:create", async (payload) => service.addTarget(targetDraftFrom(payload)));
  registry.handle("target:revise", async (payload) => {
    const request = targetRevisionRequestFrom(payload);
    return service.reviseTarget(request.previousId, request.patch);
  });
}

function targetDraftFrom(payload: unknown): TargetDraft {
  const value = recordFrom(payload);
  return {
    description: requiredString(value, "description"),
    negativeCognition: requiredString(value, "negativeCognition"),
    positiveCognition: requiredString(value, "positiveCognition"),
    clusterTag: optionalString(value, "clusterTag"),
    initialDisturbance: optionalNumberInRange(value, "initialDisturbance", disturbanceRange),
    currentDisturbance: optionalNumberInRange(value, "currentDisturbance", disturbanceRange),
    status: optionalStringEnum(value, "status", targetStatuses, "a target status"),
    notes: optionalString(value, "notes")
  };
}

function targetRevisionRequestFrom(payload: unknown): TargetRevisionRequest {
  const value = recordFrom(payload);
  const patch = requiredRecord(value, "patch");
  return {
    previousId: requiredString(value, "previousId"),
    patch: {
      description: optionalString(patch, "description"),
      negativeCognition: optionalString(patch, "negativeCognition"),
      positiveCognition: optionalString(patch, "positiveCognition"),
      clusterTag: optionalString(patch, "clusterTag"),
      initialDisturbance: optionalNumberInRange(patch, "initialDisturbance", disturbanceRange),
      currentDisturbance: optionalNumberInRange(patch, "currentDisturbance", disturbanceRange),
      status: optionalStringEnum(patch, "status", targetStatuses, "a target status"),
      notes: optionalString(patch, "notes")
    }
  };
}
