import type { Database } from "../app/types.js";
import type { SessionAggregate } from "./types.js";
import type { Target } from "../target/entity.js";
import { createSessionForTarget } from "./factory.js";
import { reviseTarget } from "../target/service.js";
import { replaceById, nowIso } from "../../utils.js";

export function startSessionForTarget(database: Database, target: Target) {
  const session = createSessionForTarget(target);

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
