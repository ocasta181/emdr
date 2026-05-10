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
export const TARGET_ROOT_ID_PREFIX = "trg";

export function createTarget(draft: TargetDraft): Target {
  const now = nowIso();
  const rootTargetId = createId(TARGET_ROOT_ID_PREFIX);

  return {
    id: createId(TARGET_ID_PREFIX),
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
    id: createId(TARGET_ID_PREFIX),
    rootTargetId: previous.rootTargetId,
    parentTargetId: previous.id,
    isCurrent: true,
    createdAt: now,
    updatedAt: now
  };
}
