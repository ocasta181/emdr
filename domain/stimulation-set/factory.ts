import { createId, nowIso } from "../../utils.js";
import type { StimulationSet } from "./entity.js";

type StimulationSetDraft = Pick<StimulationSet, "sessionId" | "setNumber" | "cycleCount" | "observation"> &
  Partial<Pick<StimulationSet, "disturbance">>;

export const STIMULATION_SET_ID_PREFIX = "set";

export function createStimulationSet(draft: StimulationSetDraft): StimulationSet {
  return {
    id: createId(STIMULATION_SET_ID_PREFIX),
    createdAt: nowIso(),
    ...draft
  };
}
