import type { Database } from "../app/types";
import type { Target } from "./entity";
import { nowIso } from "../../support/ids";
import { createTargetRevision } from "./factory";

export function currentTargets(database: Database) {
  return database.targets
    .filter((target) => target.isCurrent)
    .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
}

export function activeTargets(database: Database) {
  return currentTargets(database).filter((target) => target.status === "active");
}

export function reviseTarget(
  database: Database,
  previous: Target,
  patch: Partial<Omit<Target, "id" | "rootTargetId" | "parentTargetId" | "createdAt">>
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
