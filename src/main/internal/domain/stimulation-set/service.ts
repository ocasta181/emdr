import type { SQLBaseRepository } from "../../lib/store/repository/base.js";
import type { StimulationSet } from "./entity.js";
import type { SessionLookup, StimulationSetDraft } from "./types.js";
import { createStimulationSet } from "./factory.js";

export class StimulationSetService {
  constructor(
    private readonly repo: SQLBaseRepository<StimulationSet>,
    private readonly sessions?: SessionLookup
  ) {}

  logStimulationSet(draft: StimulationSetDraft): StimulationSet {
    this.sessions?.requireSession(draft.sessionId);
    const existingSets = this.repo.findBy("sessionId", draft.sessionId);
    const set = createStimulationSet({
      sessionId: draft.sessionId,
      setNumber: existingSets.length + 1,
      cycleCount: draft.cycleCount,
      observation: draft.observation,
      disturbance: draft.disturbance
    });
    this.repo.insert(set);
    return set;
  }

  listBySession(sessionId: string): StimulationSet[] {
    this.sessions?.requireSession(sessionId);
    return this.repo.findBy("sessionId", sessionId);
  }
}
