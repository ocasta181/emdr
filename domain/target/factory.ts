import { createId, nowIso } from "../../utils.js";
import type { Target } from "./entity.js";

type TargetDraft = Pick<Target, "description" | "negativeCognition" | "positiveCognition"> &
  Partial<
    Pick<
      Target,
      "clusterTag" | "initialDisturbance" | "currentDisturbance" | "status" | "notes"
    >
  >;

export const TARGET_ID_PREFIX = "tgt";

export function createTarget(draft: TargetDraft): Target {
  const now = nowIso();

  return {
    id: createId(TARGET_ID_PREFIX),
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
    status: "active",
    ...draft
  };
}

export function createTargetRevision(
  previous: Target,
  patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>
): Target {
  const now = nowIso();
  const targetFields = {
    description: previous.description,
    negativeCognition: previous.negativeCognition,
    positiveCognition: previous.positiveCognition,
    clusterTag: previous.clusterTag,
    initialDisturbance: previous.initialDisturbance,
    currentDisturbance: previous.currentDisturbance,
    status: previous.status,
    notes: previous.notes
  };

  return {
    ...targetFields,
    ...patch,
    id: createId(TARGET_ID_PREFIX),
    parentId: previous.id,
    isCurrent: true,
    createdAt: now,
    updatedAt: now
  };
}
