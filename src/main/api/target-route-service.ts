import type { Target, TargetStatus } from "../internal/domain/target/entity.js";
import { newTargetRepository } from "../internal/domain/target/repository.js";
import { TargetService } from "../internal/domain/target/service.js";
import type { TargetDraft } from "../internal/domain/target/types.js";
import type { TargetRouteService } from "../internal/domain/target/ipc.types.js";
import { mutateAppDatabase, readFromAppDatabase } from "../internal/lib/store/sqlite/app-store.js";

export function createTargetRouteService(options: { getUserDataPath: () => string }): TargetRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async list() {
      return readFromAppDatabase(userDataPath(), (db) => new TargetService(newTargetRepository(db)).listCurrentTargets());
    },

    async create(payload) {
      return mutateAppDatabase(userDataPath(), (db) => new TargetService(newTargetRepository(db)).addTarget(targetDraftFrom(payload)));
    },

    async revise(payload) {
      const request = targetRevisionRequestFrom(payload);
      return mutateAppDatabase(userDataPath(), (db) =>
        new TargetService(newTargetRepository(db)).reviseTarget(request.previousId, request.patch)
      );
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
