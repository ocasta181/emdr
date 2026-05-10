export type TargetStatus = "active" | "completed" | "deferred";

export type Target = {
  id: string;
  rootTargetId: string;
  parentTargetId?: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  description: string;
  negativeCognition: string;
  positiveCognition: string;
  clusterTag?: string;
  initialDisturbance?: number;
  currentDisturbance?: number;
  status: TargetStatus;
  notes?: string;
};
