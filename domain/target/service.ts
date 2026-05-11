import type { Database } from "../app/types.js";
import type { Target } from "./entity.js";
import { nowIso } from "../../utils.js";
import { createTargetRevision } from "./factory.js";

export function currentTargets(database: Database) {
  return database.targets
    .filter((target) => target.isCurrent)
    .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
}

export function reviseTarget(
  database: Database,
  previous: Target,
  patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>
): Database {
  const now = nowIso();
  const nextTarget = createTargetRevision(previous, patch);

  return {
    ...database,
    targets: database.targets
      .map((target) => (target.id === previous.id ? { ...target, isCurrent: false, updatedAt: now } : target))
      .concat(nextTarget)
  };
}
