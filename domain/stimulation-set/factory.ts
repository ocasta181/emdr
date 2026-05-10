import { createId, nowIso } from "../../support/ids";
import type { StimulationSet } from "./entity";

type StimulationSetDraft = Pick<StimulationSet, "sessionId" | "setNumber" | "cycleCount" | "observation"> &
  Partial<Pick<StimulationSet, "disturbance">>;

export function createStimulationSet(draft: StimulationSetDraft): StimulationSet {
  return {
    id: createId("set"),
    createdAt: nowIso(),
    ...draft
  };
}
