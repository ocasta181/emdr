import { createId, nowIso } from "../../support/ids.js";
import type { Target } from "../target/entity.js";
import type { SessionAggregate } from "./types.js";

export function createSessionForTarget(target: Target): SessionAggregate {
  return {
    id: createId("session"),
    targetRootId: target.rootTargetId,
    targetId: target.id,
    startedAt: nowIso(),
    assessment: {
      negativeCognition: target.negativeCognition,
      positiveCognition: target.positiveCognition,
      disturbance: target.currentDisturbance
    },
    stimulationSets: []
  };
}
