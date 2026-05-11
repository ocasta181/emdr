import type { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { StimulationSet } from "./entity.js";
import type { StimulationSetDraft } from "./types.js";
import { createStimulationSet } from "./factory.js";

export function logStimulationSet(repo: SQLBaseRepository<StimulationSet>, draft: StimulationSetDraft) {
  const existingSets = repo.findBy("sessionId", draft.sessionId);
  const set = createStimulationSet({
    sessionId: draft.sessionId,
    setNumber: existingSets.length + 1,
    cycleCount: draft.cycleCount,
    observation: draft.observation,
    disturbance: draft.disturbance
  });
  repo.insert(set);
  return set;
}

export function listBySession(repo: SQLBaseRepository<StimulationSet>, sessionId: string) {
  return repo.findBy("sessionId", sessionId);
}
