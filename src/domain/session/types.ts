export type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
};

export type StimulationSet = {
  id: string;
  sessionId: string;
  setNumber: number;
  createdAt: string;
  cycleCount: number;
  observation: string;
  disturbance?: number;
};

export type Session = {
  id: string;
  targetRootId: string;
  targetId: string;
  startedAt: string;
  endedAt?: string;
  assessment: Assessment;
  stimulationSets: StimulationSet[];
  finalDisturbance?: number;
  notes?: string;
};
