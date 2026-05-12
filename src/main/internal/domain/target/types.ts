import type { Target } from "./entity.js";

export type TargetDraft = Pick<Target, "description" | "negativeCognition" | "positiveCognition"> &
  Partial<Pick<Target, "clusterTag" | "initialDisturbance" | "currentDisturbance" | "status" | "notes">>;
