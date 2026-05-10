import type { ActivityEvent, Database, Session, TargetVersion } from "./types";

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

export function headTargets(database: Database) {
  return database.targets
    .filter((target) => target.isHead)
    .sort((a, b) => (b.currentSud ?? -1) - (a.currentSud ?? -1));
}

export function activeTargets(database: Database) {
  return headTargets(database).filter((target) => target.status === "active");
}

export function versionTarget(
  database: Database,
  previous: TargetVersion,
  patch: Partial<Omit<TargetVersion, "id" | "rootTargetId" | "parentVersionId" | "createdAt">>
): Database {
  const now = nowIso();
  const nextVersion: TargetVersion = {
    ...previous,
    ...patch,
    id: createId("target"),
    rootTargetId: previous.rootTargetId,
    parentVersionId: previous.id,
    isHead: true,
    createdAt: now,
    updatedAt: now
  };

  return {
    ...database,
    targets: database.targets
      .map((target) => (target.id === previous.id ? { ...target, isHead: false, updatedAt: now } : target))
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
