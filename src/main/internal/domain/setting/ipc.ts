import type { ApiRegistry } from "../../../api/types.js";
import { optionalNumberInRange, optionalStringEnum, recordFrom } from "../../lib/ipc/payload.js";
import type { BilateralStimulationSettings, SettingIpcService } from "./types.js";

const dotSizes = ["small", "medium", "large"] as const satisfies readonly BilateralStimulationSettings["dotSize"][];
const dotColors = ["green", "blue", "white", "orange"] as const satisfies readonly BilateralStimulationSettings["dotColor"][];

export function registerSettingIpc(registry: ApiRegistry, service: SettingIpcService) {
  registry.handle("settings:get", async () => service.getSettings());
  registry.handle("settings:update-bilateral-stimulation", async (payload) =>
    service.updateBilateralStimulationSettings(bilateralStimulationPatchFrom(payload))
  );
}

function bilateralStimulationPatchFrom(payload: unknown): Partial<BilateralStimulationSettings> {
  const value = recordFrom(payload);
  const patch: Partial<BilateralStimulationSettings> = {};
  const speed = optionalNumberInRange(value, "speed", { min: 0.5, max: 2.5 });
  const dotSize = optionalStringEnum(value, "dotSize", dotSizes, "a dot size");
  const dotColor = optionalStringEnum(value, "dotColor", dotColors, "a dot color");

  if (speed !== undefined) patch.speed = speed;
  if (dotSize !== undefined) patch.dotSize = dotSize;
  if (dotColor !== undefined) patch.dotColor = dotColor;

  return patch;
}
