import { createId, nowIso } from "../../utils.js";
import type { Target } from "../target/entity.js";
import type { Session } from "./entity.js";
import type { SessionAggregate } from "./types.js";
import type { StimulationSet } from "../stimulation-set/entity.js";

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

export function createSessionFromAggregate(session: SessionAggregate): Session {
  return {
    id: session.id,
    targetRootId: session.targetRootId,
    targetId: session.targetId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    assessmentImage: session.assessment.image,
    assessmentNegativeCognition: session.assessment.negativeCognition,
    assessmentPositiveCognition: session.assessment.positiveCognition,
    assessmentBelievability: session.assessment.believability,
    assessmentEmotions: session.assessment.emotions,
    assessmentDisturbance: session.assessment.disturbance,
    assessmentBodyLocation: session.assessment.bodyLocation,
    finalDisturbance: session.finalDisturbance,
    notes: session.notes
  };
}

export function createSessionAggregate(session: Session, stimulationSets: StimulationSet[]): SessionAggregate {
  return {
    id: session.id,
    targetRootId: session.targetRootId,
    targetId: session.targetId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    assessment: {
      image: session.assessmentImage,
      negativeCognition: session.assessmentNegativeCognition,
      positiveCognition: session.assessmentPositiveCognition,
      believability: session.assessmentBelievability,
      emotions: session.assessmentEmotions,
      disturbance: session.assessmentDisturbance,
      bodyLocation: session.assessmentBodyLocation
    },
    stimulationSets,
    finalDisturbance: session.finalDisturbance,
    notes: session.notes
  };
}
