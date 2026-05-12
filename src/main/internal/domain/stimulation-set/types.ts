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
