import type {
  MediaAccessPermissionRequest,
  PermissionCheckHandlerHandlerDetails,
  PermissionRequest,
  Session
} from "electron";
import type { AudioMediaPermissionCandidate, ElectronPermissionPolicyOptions } from "./permissions.types.js";

export function installPermissionPolicy(electronSession: Session, options: ElectronPermissionPolicyOptions) {
  electronSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission !== "media") return false;

    return allowsAudioMediaPermission(candidateFromPermissionCheck(requestingOrigin, details), options);
  });

  electronSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission !== "media") {
      callback(false);
      return;
    }

    callback(allowsAudioMediaPermission(candidateFromPermissionRequest(details), options));
  });
}

export function allowsAudioMediaPermission(
  candidate: AudioMediaPermissionCandidate,
  options: ElectronPermissionPolicyOptions
) {
  return (
    candidate.isMainFrame &&
    candidate.mediaTypes.length === 1 &&
    candidate.mediaTypes[0] === "audio" &&
    [
      candidate.requestingUrl,
      candidate.securityOrigin,
      candidate.requestingOrigin
    ].some((location) => isAllowedRendererLocation(location, options))
  );
}

function candidateFromPermissionCheck(
  requestingOrigin: string,
  details: PermissionCheckHandlerHandlerDetails
): AudioMediaPermissionCandidate {
  return {
    isMainFrame: details.isMainFrame,
    mediaTypes: details.mediaType ? [details.mediaType] : [],
    requestingOrigin,
    requestingUrl: details.requestingUrl,
    securityOrigin: details.securityOrigin
  };
}

function candidateFromPermissionRequest(
  details: PermissionRequest | MediaAccessPermissionRequest
): AudioMediaPermissionCandidate {
  const mediaDetails = details as MediaAccessPermissionRequest;
  return {
    isMainFrame: mediaDetails.isMainFrame,
    mediaTypes: mediaDetails.mediaTypes ?? [],
    requestingUrl: mediaDetails.requestingUrl,
    securityOrigin: mediaDetails.securityOrigin
  };
}

function isAllowedRendererLocation(location: string | undefined, options: ElectronPermissionPolicyOptions) {
  if (!location) return false;
  if (location.startsWith("file:")) return true;
  if (!options.devServerUrl) return false;

  return originFor(location) === originFor(options.devServerUrl);
}

function originFor(location: string) {
  try {
    return new URL(location).origin;
  } catch {
    return undefined;
  }
}
