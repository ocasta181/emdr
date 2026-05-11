import type { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { Target } from "./entity.js";
import { createTarget, createTargetRevision } from "./factory.js";
import { nowIso } from "../../utils.js";

import type { TargetDraft } from "./types.js";

export function listCurrentTargets(repo: SQLBaseRepository<Target>): Target[] {
  return repo
    .all()
    .filter((target) => target.isCurrent)
    .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
}

export function addTarget(repo: SQLBaseRepository<Target>, draft: TargetDraft): Target {
  const target = createTarget(draft);
  repo.insert(target);
  return target;
}

export function reviseTarget(
  repo: SQLBaseRepository<Target>,
  previousId: string,
  patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>
): Target {
  const previous = repo.find(previousId);
  if (!previous) {
    throw new Error(`Target not found: ${previousId}`);
  }
  repo.update(previousId, { isCurrent: false, updatedAt: nowIso() } as Partial<Target>);
  const next = createTargetRevision(previous, patch);
  repo.insert(next);
  return next;
}
