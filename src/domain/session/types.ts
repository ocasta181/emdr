import type { StimulationSet } from "../stimulation-set/entity";

export type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
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
