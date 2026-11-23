import type { SQLBaseRepository } from "../../lib/store/repository/base.js";
import type { StimulationSet } from "./entity.js";
import type {
  SessionLookup,
  StimulationSetDraft,
  StimulationSetObservationDraft,
  StimulationSetSessionWorkflow
} from "./types.js";
import { createStimulationSet } from "./factory.js";

export class StimulationSetService {
  constructor(
    private readonly repo: SQLBaseRepository<StimulationSet>,
    private readonly sessions?: SessionLookup,
    private readonly sessionWorkflow?: StimulationSetSessionWorkflow
  ) {}

  logStimulationSet(draft: StimulationSetDraft): StimulationSet {
    this.sessions?.requireSession(draft.sessionId);
    this.sessionWorkflow?.requireActiveSessionAction(draft.sessionId, "log_stimulation_set");
    const existingSets = this.repo.findBy("sessionId", draft.sessionId);
    const set = createStimulationSet({
      sessionId: draft.sessionId,
      setNumber: existingSets.length + 1,
      cycleCount: draft.cycleCount,
      observation: draft.observation,
      disturbance: draft.disturbance
    });
    this.repo.insert(set);
    this.sessionWorkflow?.applyActiveSessionAction(draft.sessionId, "log_stimulation_set");
    return set;
  }

  /** Records what the person noticed after a set; only the active session's own sets can be updated. */
  recordObservation(draft: StimulationSetObservationDraft): StimulationSet {
    this.sessions?.requireSession(draft.sessionId);
    this.sessionWorkflow?.requireActiveSessionAction(draft.sessionId, "record_set_observation");
    const set = this.repo.findBy("sessionId", draft.sessionId).find((item) => item.id === draft.setId);
    if (!set) {
      throw new Error(`Stimulation set ${draft.setId} does not belong to session ${draft.sessionId}.`);
    }
    const patch = { observation: draft.observation, disturbance: draft.disturbance };
    this.repo.update(set.id, patch);
    this.sessionWorkflow?.applyActiveSessionAction(draft.sessionId, "record_set_observation");
    return { ...set, ...patch };
  }

  listBySession(sessionId: string): StimulationSet[] {
    this.sessions?.requireSession(sessionId);
    return this.repo.findBy("sessionId", sessionId);
  }
}
