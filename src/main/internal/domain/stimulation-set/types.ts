import type { StimulationSet } from "./entity.js";

export type StimulationSetDraft = {
  sessionId: string;
  cycleCount: number;
  observation: string;
  disturbance?: number;
};

export type StimulationSetRecordDraft = StimulationSetDraft & {
  setNumber: number;
};

export type SessionLookup = {
  requireSession(sessionId: string): unknown;
};

export type StimulationSetIpcService = {
  listBySession(sessionId: string): StimulationSet[] | Promise<StimulationSet[]>;
  logStimulationSet(draft: StimulationSetDraft): StimulationSet | Promise<StimulationSet>;
};
