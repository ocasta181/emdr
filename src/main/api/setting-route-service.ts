import { newSettingRepository } from "../internal/domain/setting/repository.js";
import { SettingService } from "../internal/domain/setting/service.js";
import type { BilateralStimulationSettings } from "../internal/domain/setting/types.js";
import type { SettingRouteService } from "../internal/domain/setting/ipc.types.js";
import { mutateAppDatabase, readFromAppDatabase } from "../internal/lib/store/sqlite/app-store.js";

export function createSettingRouteService(options: { getUserDataPath: () => string }): SettingRouteService {
  const userDataPath = options.getUserDataPath;

  return {
    async get() {
      return readFromAppDatabase(userDataPath(), (db) => new SettingService(newSettingRepository(db)).getSettings());
    },

    async updateBilateralStimulation(payload) {
      return mutateAppDatabase(userDataPath(), (db) =>
        new SettingService(newSettingRepository(db)).updateBilateralStimulationSettings(
          bilateralStimulationPatchFrom(payload)
        )
      );
    }
  };
}

function bilateralStimulationPatchFrom(payload: unknown): Partial<BilateralStimulationSettings> {
  const value = recordFrom(payload);
  return {
    speed: optionalNumber(value, "speed"),
    dotSize: optionalDotSize(value, "dotSize"),
    dotColor: optionalDotColor(value, "dotColor")
  };
}

function recordFrom(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object payload.");
  }
  return value as Record<string, unknown>;
}

function optionalNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function optionalDotSize(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (field === undefined) return undefined;
  if (field === "small" || field === "medium" || field === "large") return field;
  throw new Error(`Expected ${key} to be a dot size.`);
}

function optionalDotColor(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (field === undefined) return undefined;
  if (field === "green" || field === "blue" || field === "white" || field === "orange") return field;
  throw new Error(`Expected ${key} to be a dot color.`);
}
