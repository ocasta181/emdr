import type { Session } from "electron";
import type { NetworkGuardOptions } from "./network.types.js";

export function installNetworkGuard(session: Session, options: NetworkGuardOptions) {
  session.webRequest.onBeforeRequest((details, callback) => {
    const allowed =
      details.url.startsWith("file:") ||
      details.url.startsWith("devtools:") ||
      (options.devServerUrl !== undefined && details.url.startsWith(options.devServerUrl));

    callback({ cancel: !allowed });
  });
}
