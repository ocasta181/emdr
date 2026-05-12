import { loadAppDatabase, saveAppDatabase } from "../internal/lib/store/sqlite/app-store.js";
import { createTarget, createTargetRevision } from "../../../domain/target/factory.js";
import type { Target, TargetStatus } from "../../../domain/target/entity.js";
import type { TargetDraft } from "../../../domain/target/types.js";
import { nowIso } from "../../../utils.js";
import type { TargetRouteService } from "../internal/domain/target/types.js";

export function createTargetRouteService(options: { getUserDataPath: () => string }): TargetRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async list() {
      const database = await loadAppDatabase(userDataPath());
      return database.targets
        .filter((target) => target.isCurrent)
        .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
    },

    async create(payload) {
      const database = await loadAppDatabase(userDataPath());
      const target = createTarget(targetDraftFrom(payload));
      await saveAppDatabase(userDataPath(), { ...database, targets: database.targets.concat(target) });
      return target;
    },

    async revise(payload) {
      const request = targetRevisionRequestFrom(payload);
      const database = await loadAppDatabase(userDataPath());
      const previous = database.targets.find((target) => target.id === request.previousId);
      if (!previous) {
        throw new Error(`Target not found: ${request.previousId}`);
      }

      const next = createTargetRevision(previous, request.patch);
      await saveAppDatabase(userDataPath(), {
        ...database,
        targets: database.targets
          .map((target) =>
            target.id === previous.id ? { ...target, isCurrent: false, updatedAt: nowIso() } : target
          )
          .concat(next)
      });
      return next;
    }
  };
}

function targetDraftFrom(payload: unknown): TargetDraft {
  const value = recordFrom(payload);
  return {
    description: requiredString(value, "description"),
    negativeCognition: requiredString(value, "negativeCognition"),
    positiveCognition: requiredString(value, "positiveCognition"),
    clusterTag: optionalString(value, "clusterTag"),
    initialDisturbance: optionalNumber(value, "initialDisturbance"),
    currentDisturbance: optionalNumber(value, "currentDisturbance"),
    status: optionalTargetStatus(value, "status"),
    notes: optionalString(value, "notes")
  };
}

function targetRevisionRequestFrom(payload: unknown) {
  const value = recordFrom(payload);
  const patch = recordFrom(value.patch);
  return {
    previousId: requiredString(value, "previousId"),
    patch: {
      description: optionalString(patch, "description"),
      negativeCognition: optionalString(patch, "negativeCognition"),
      positiveCognition: optionalString(patch, "positiveCognition"),
      clusterTag: optionalString(patch, "clusterTag"),
      initialDisturbance: optionalNumber(patch, "initialDisturbance"),
      currentDisturbance: optionalNumber(patch, "currentDisturbance"),
      status: optionalTargetStatus(patch, "status"),
      notes: optionalString(patch, "notes")
    } as Partial<Omit<Target, "id" | "parentId" | "createdAt">>
  };
}

function recordFrom(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object payload.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }
  return field;
}

function optionalString(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function optionalNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function optionalTargetStatus(value: Record<string, unknown>, key: string): TargetStatus | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (field === "active" || field === "completed" || field === "deferred") return field;
  throw new Error(`Expected ${key} to be a target status.`);
}
