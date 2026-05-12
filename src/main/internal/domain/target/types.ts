import type { Target } from "./entity.js";

export type TargetDraft = Pick<Target, "description" | "negativeCognition" | "positiveCognition"> &
  Partial<Pick<Target, "clusterTag" | "initialDisturbance" | "currentDisturbance" | "status" | "notes">>;

export type TargetRevisionRequest = {
  previousId: string;
  patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>;
};

export type TargetIpcService = {
  listCurrentTargets(): Target[] | Promise<Target[]>;
  listAllTargets(): Target[] | Promise<Target[]>;
  addTarget(draft: TargetDraft): Target | Promise<Target>;
  reviseTarget(previousId: string, patch: TargetRevisionRequest["patch"]): Target | Promise<Target>;
};
