import type { ApiRegistry } from "../../../api/types.js";
import { optionalString, recordFrom } from "../../lib/ipc/payload.js";
import type { GuideIpcService, GuideViewRequest } from "./types.js";

export function registerGuideIpc(registry: ApiRegistry, service: GuideIpcService) {
  registry.handle("guide:view", async (payload) => service.getView(guideViewRequestFrom(payload)));
}

function guideViewRequestFrom(payload: unknown): GuideViewRequest {
  if (payload === undefined || payload === null) return {};

  const value = recordFrom(payload);
  return {
    activeSessionId: optionalString(value, "activeSessionId")
  };
}
