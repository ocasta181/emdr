import { createId, nowIso } from "../../support/ids";
import type { Target } from "../target/entity";
import type { SessionAggregate } from "./types";

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
