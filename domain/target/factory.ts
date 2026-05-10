import { createId, nowIso } from "../../utils.js";
import type { Target } from "./entity.js";

type TargetDraft = Pick<Target, "description" | "negativeCognition" | "positiveCognition"> &
  Partial<
    Pick<
      Target,
      "clusterTag" | "initialDisturbance" | "currentDisturbance" | "status" | "notes"
    >
  >;

export function createTarget(draft: TargetDraft): Target {
  const now = nowIso();
  const rootTargetId = createId("target_root");

  return {
    id: createId("target"),
    rootTargetId,
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
    status: "active",
    ...draft
  };
}

export function createTargetRevision(
  previous: Target,
  patch: Partial<Omit<Target, "id" | "rootTargetId" | "parentTargetId" | "createdAt">>
): Target {
  const now = nowIso();

  return {
    ...previous,
    ...patch,
    id: createId("target"),
    rootTargetId: previous.rootTargetId,
    parentTargetId: previous.id,
    isCurrent: true,
    createdAt: now,
    updatedAt: now
  };
}
