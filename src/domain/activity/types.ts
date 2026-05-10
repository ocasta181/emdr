export type ActivityEntity = "target" | "session" | "settings";

export type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  entityType?: ActivityEntity;
  entityId?: string;
  payload?: Record<string, unknown>;
};
