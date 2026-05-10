import type { Database } from "./types";
import type { SessionAggregate } from "../session/types";
import type { Target } from "../target/entity";
import { reviseTarget } from "../target/service";
import { replaceById } from "../../support/collection";
import { createId, nowIso } from "../../support/ids";

export function startSessionForTarget(database: Database, target: Target) {
  const session: SessionAggregate = {
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

  return {
    database: saveSessionDraft(database, session),
    session
  };
}

export function saveSessionDraft(database: Database, session: SessionAggregate): Database {
  return {
    ...database,
    sessions: replaceById(database.sessions, session)
  };
}

export function endSession(database: Database, session: SessionAggregate): Database {
  const ended = {
    ...session,
    endedAt: nowIso()
  };
  const target = database.targets.find((item) => item.id === ended.targetId);
  let nextDatabase = saveSessionDraft(database, ended);

  if (target && typeof ended.finalDisturbance === "number") {
    nextDatabase = reviseTarget(nextDatabase, target, { currentDisturbance: ended.finalDisturbance });
  }

  return nextDatabase;
}
