import { createId, nowIso } from "../../../../../utils.js";
import type { StimulationSet } from "./entity.js";
import type { StimulationSetRecordDraft } from "./types.js";

export const STIMULATION_SET_ID_PREFIX = "set";

export function createStimulationSet(draft: StimulationSetRecordDraft): StimulationSet {
  return {
    id: createId(STIMULATION_SET_ID_PREFIX),
    createdAt: nowIso(),
    ...draft
  };
}
