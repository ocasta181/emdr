import type { StimulationSetRepository } from "./repository.js";
import type { StimulationSetDraft } from "./types.js";
import { createStimulationSet } from "./factory.js";

export function logStimulationSet(repo: StimulationSetRepository, draft: StimulationSetDraft) {
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

export function listBySession(repo: StimulationSetRepository, sessionId: string) {
  return repo.findBy("sessionId", sessionId);
}
