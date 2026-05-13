import type { SQLBaseRepository } from "../../lib/store/repository/base.js";
import type { Target } from "./entity.js";
import { createTarget, createTargetRevision } from "./factory.js";
import { nowIso } from "../../../../../utils.js";

import type { TargetDraft } from "./types.js";

export class TargetService {
  constructor(private readonly repo: SQLBaseRepository<Target>) {}

  requireTarget(targetId: string): Target {
    const target = this.repo.find(targetId);
    if (!target) {
      throw new Error(`Target not found: ${targetId}`);
    }
    return target;
  }

  listCurrentTargets(): Target[] {
    return this.repo
      .all()
      .filter((target) => target.isCurrent)
      .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
  }

  listAllTargets(): Target[] {
    return this.repo.all();
  }

  addTarget(draft: TargetDraft): Target {
    const target = createTarget({ ...draft, description: targetDescriptionFrom(draft.description) });
    this.repo.insert(target);
    return target;
  }

  reviseTarget(previousId: string, patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>): Target {
    const previous = this.requireTarget(previousId);
    this.repo.update(previousId, { isCurrent: false, updatedAt: nowIso() } as Partial<Target>);
    const next = createTargetRevision(previous, normalizedTargetPatch(patch));
    this.repo.insert(next);
    return next;
  }
}

function normalizedTargetPatch(patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>) {
  if (patch.description === undefined) return patch;
  return { ...patch, description: targetDescriptionFrom(patch.description) };
}

function targetDescriptionFrom(description: string) {
  const normalized = description.trim();
  if (!normalized) {
    throw new Error("Target description is required.");
  }
  return normalized;
}
