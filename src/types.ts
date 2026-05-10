export type TargetStatus = "active" | "completed" | "deferred";

export type TargetVersion = {
  id: string;
  rootTargetId: string;
  parentVersionId?: string;
  isHead: boolean;
  createdAt: string;
  updatedAt: string;
  description: string;
  negativeCognition: string;
  positiveCognition: string;
  clusterTag?: string;
  initialSud?: number;
  currentSud?: number;
  status: TargetStatus;
  notes?: string;
};

export type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  validityOfCognition?: number;
  emotions?: string;
  subjectiveUnitsOfDisturbance?: number;
  bodyLocation?: string;
};

export type StimulationSet = {
  id: string;
  sessionId: string;
  setNumber: number;
  createdAt: string;
  cycleCount: number;
  observation: string;
  subjectiveUnitsOfDisturbance?: number;
};

export type Session = {
  id: string;
  targetRootId: string;
  targetVersionId: string;
  startedAt: string;
  endedAt?: string;
  assessment: Assessment;
  stimulationSets: StimulationSet[];
  finalSud?: number;
  notes?: string;
};

export type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  entityType?: "target" | "session" | "settings";
  entityId?: string;
  payload?: Record<string, unknown>;
};

export type Database = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: TargetVersion[];
  sessions: Session[];
  activityEvents: ActivityEvent[];
  settings: {
    bilateralStimulation: {
      speed: number;
      dotSize: "small" | "medium" | "large";
      dotColor: "green" | "blue" | "white" | "orange";
    };
  };
};
