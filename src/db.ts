import type { ActivityEvent, Database, Session, Target } from "./types";

const STORAGE_KEY = "emdr-local-dev-db";

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createEmptyDatabase(): Database {
  const now = nowIso();
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    targets: [],
    sessions: [],
    activityEvents: [],
    settings: {
      bilateralStimulation: {
        speed: 1,
        dotSize: "medium",
        dotColor: "green"
      }
    }
  };
}

export function createEvent(
  type: string,
  entityType?: ActivityEvent["entityType"],
  entityId?: string,
  payload?: Record<string, unknown>
): ActivityEvent {
  return {
    id: createId("event"),
    timestamp: nowIso(),
    type,
    entityType,
    entityId,
    payload
  };
}

export async function loadDatabase(): Promise<Database> {
  if (window.emdr) {
    const loaded = await window.emdr.loadDatabase();
    return loaded ? (loaded as Database) : createEmptyDatabase();
  }

  const loaded = localStorage.getItem(STORAGE_KEY);
  return loaded ? (JSON.parse(loaded) as Database) : createEmptyDatabase();
}

export async function saveDatabase(database: Database) {
  const next = {
    ...database,
    updatedAt: nowIso()
  };

  if (window.emdr) {
    await window.emdr.saveDatabase(next);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}

export function currentTargets(database: Database) {
  return database.targets
    .filter((target) => target.isCurrent)
    .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
}

export function activeTargets(database: Database) {
  return currentTargets(database).filter((target) => target.status === "active");
}

export function reviseTarget(
  database: Database,
  previous: Target,
  patch: Partial<Omit<Target, "id" | "rootTargetId" | "parentTargetId" | "createdAt">>
): Database {
  const now = nowIso();
  const nextVersion: Target = {
    ...previous,
    ...patch,
    id: createId("target"),
    rootTargetId: previous.rootTargetId,
    parentTargetId: previous.id,
    isCurrent: true,
    createdAt: now,
    updatedAt: now
  };

  return {
    ...database,
    targets: database.targets
      .map((target) => (target.id === previous.id ? { ...target, isCurrent: false, updatedAt: now } : target))
      .concat(nextVersion),
    activityEvents: database.activityEvents.concat(
      createEvent("target.versioned", "target", nextVersion.rootTargetId, {
        previousVersionId: previous.id,
        newVersionId: nextVersion.id
      })
    )
  };
}

export function upsertSession(database: Database, session: Session, eventType: string) {
  const exists = database.sessions.some((item) => item.id === session.id);
  return {
    ...database,
    sessions: exists
      ? database.sessions.map((item) => (item.id === session.id ? session : item))
      : database.sessions.concat(session),
    activityEvents: database.activityEvents.concat(createEvent(eventType, "session", session.id))
  };
}
