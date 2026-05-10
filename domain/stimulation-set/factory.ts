import { createId, nowIso } from "../../utils.js";
import type { StimulationSet } from "./entity.js";

type StimulationSetDraft = Pick<StimulationSet, "sessionId" | "setNumber" | "cycleCount" | "observation"> &
  Partial<Pick<StimulationSet, "disturbance">>;

export function createStimulationSet(draft: StimulationSetDraft): StimulationSet {
  return {
    id: createId("set"),
    createdAt: nowIso(),
    ...draft
  };
}
