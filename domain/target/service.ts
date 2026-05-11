import type { SQLBaseRepository } from "../../core/internal/repository/base.js";
import type { Target } from "./entity.js";
import { createTarget, createTargetRevision } from "./factory.js";
import { nowIso } from "../../utils.js";

import type { TargetDraft } from "./types.js";

export class TargetService {
  constructor(private readonly repo: Pick<SQLBaseRepository<Target>, "all" | "find" | "insert" | "update">) {}

  listCurrentTargets(): Target[] {
    return this.repo
      .all()
      .filter((target) => target.isCurrent)
      .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
  }

  addTarget(draft: TargetDraft): Target {
    const target = createTarget(draft);
    this.repo.insert(target);
    return target;
  }

  reviseTarget(previousId: string, patch: Partial<Omit<Target, "id" | "parentId" | "createdAt">>): Target {
    const previous = this.repo.find(previousId);
    if (!previous) {
      throw new Error(`Target not found: ${previousId}`);
    }
    this.repo.update(previousId, { isCurrent: false, updatedAt: nowIso() } as Partial<Target>);
    const next = createTargetRevision(previous, patch);
    this.repo.insert(next);
    return next;
  }
}
