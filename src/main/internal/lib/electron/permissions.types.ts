export type ElectronPermissionPolicyOptions = {
  devServerUrl?: string;
};

export type AudioMediaPermissionCandidate = {
  isMainFrame: boolean;
  mediaTypes: readonly string[];
  requestingOrigin?: string;
  requestingUrl?: string;
  securityOrigin?: string;
};
