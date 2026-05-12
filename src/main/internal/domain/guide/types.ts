export type GuideViewRequest = {
  activeSessionId?: string;
};

export type GuideViewMode = "idle" | "session";

export type GuidePanelAction = {
  type: "open_targets";
  label: string;
};

export type GuideSessionView = {
  sessionId: string;
  targetId: string;
  targetDescription: string;
  stimulationSetCount: number;
};

export type GuideView = {
  mode: GuideViewMode;
  targetCount: number;
  messages: string[];
  primaryAction?: GuidePanelAction;
  activeSession?: GuideSessionView;
};

export type GuideTargetSummary = {
  id: string;
  description: string;
};

export type GuideSessionSummary = {
  id: string;
  targetId: string;
  endedAt?: string;
  stimulationSets: unknown[];
};

export type GuideTargetReader = {
  listCurrentTargets(): GuideTargetSummary[];
  listAllTargets(): GuideTargetSummary[];
};

export type GuideSessionReader = {
  listSessions(): GuideSessionSummary[];
};

export type GuideIpcService = {
  getView(request: GuideViewRequest): GuideView | Promise<GuideView>;
};
