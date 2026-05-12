import { createId, nowIso } from "../utils";
import type {
  BilateralStimulationSettings,
  Database,
  SessionAggregate,
  SessionEndPatch,
  StimulationSet,
  StimulationSetDraft,
  Target,
  TargetDraft
} from "./types";

const STORAGE_KEY = "emdr-local-dev-db";

export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export async function getVaultStatus(): Promise<VaultStatus> {
  return window.emdr ? window.emdr.request<VaultStatus>("vault:status") : "unlocked";
}

export async function createVault(password: string) {
  return window.emdr ? window.emdr.request<{ recoveryCode: string }>("vault:create", password) : { recoveryCode: "" };
}

export async function unlockWithPassword(password: string) {
  if (window.emdr) {
    await window.emdr.request("vault:unlock-password", password);
  }
}

export async function unlockWithRecoveryCode(recoveryCode: string) {
  if (window.emdr) {
    await window.emdr.request("vault:unlock-recovery", recoveryCode);
  }
}

export async function exportVault() {
  return window.emdr
    ? window.emdr.request<{ canceled: true } | { canceled: false; path: string }>("vault:export")
    : { canceled: true as const };
}

export async function importVault() {
  return window.emdr ? window.emdr.request<{ canceled: boolean }>("vault:import") : { canceled: true };
}

export async function loadDatabase(): Promise<Database> {
  if (window.emdr) {
    const loaded = await window.emdr.request<unknown | null>("legacy:load-database");
    return loaded ? (loaded as Database) : emptyDatabase();
  }

  const loaded = localStorage.getItem(STORAGE_KEY);
  return loaded ? (JSON.parse(loaded) as Database) : emptyDatabase();
}

export async function saveDatabase(database: Database) {
  if (window.emdr) {
    await window.emdr.request("legacy:save-database", database);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  }
}

export async function listTargets(): Promise<Target[]> {
  return window.emdr ? window.emdr.request<Target[]>("target:list") : currentTargets((await loadDatabase()).targets);
}

export async function createTarget(draft: TargetDraft): Promise<Target> {
  if (window.emdr) {
    return window.emdr.request<Target>("target:create", draft);
  }

  const database = await loadDatabase();
  const target = createLocalTarget(draft);
  await saveDatabase({ ...database, targets: database.targets.concat(target) });
  return target;
}

export async function reviseTarget(previousId: string, patch: Partial<Target>): Promise<Target> {
  if (window.emdr) {
    return window.emdr.request<Target>("target:revise", { previousId, patch });
  }

  const database = await loadDatabase();
  const previous = database.targets.find((target) => target.id === previousId);
  if (!previous) {
    throw new Error(`Target not found: ${previousId}`);
  }
  const next = createLocalTargetRevision(previous, patch);
  await saveDatabase({
    ...database,
    targets: database.targets
      .map((target) => (target.id === previousId ? { ...target, isCurrent: false, updatedAt: nowIso() } : target))
      .concat(next)
  });
  return next;
}

export async function startSession(targetId: string): Promise<SessionAggregate> {
  if (window.emdr) {
    return window.emdr.request<SessionAggregate>("session:start", { targetId });
  }

  const database = await loadDatabase();
  const target = database.targets.find((item) => item.id === targetId);
  if (!target) {
    throw new Error(`Target not found: ${targetId}`);
  }
  const session = createLocalSession(target);
  await saveDatabase({ ...database, sessions: database.sessions.concat(session) });
  return session;
}

export async function updateSessionAssessment(sessionId: string, assessment: SessionAggregate["assessment"]) {
  if (window.emdr) {
    return window.emdr.request<SessionAggregate>("session:update-assessment", { sessionId, assessment });
  }

  const database = await loadDatabase();
  const session = requireLocalSession(database, sessionId);
  const nextSession = { ...session, assessment };
  await saveDatabase({
    ...database,
    sessions: database.sessions.map((item) => (item.id === sessionId ? nextSession : item))
  });
  return nextSession;
}

export async function endSession(patch: SessionEndPatch): Promise<SessionAggregate> {
  if (window.emdr) {
    return window.emdr.request<SessionAggregate>("session:end", patch);
  }

  const database = await loadDatabase();
  const session = requireLocalSession(database, patch.sessionId);
  const nextSession = {
    ...session,
    endedAt: nowIso(),
    finalDisturbance: patch.finalDisturbance ?? session.finalDisturbance,
    notes: patch.notes ?? session.notes
  };
  await saveDatabase({
    ...database,
    sessions: database.sessions.map((item) => (item.id === patch.sessionId ? nextSession : item))
  });
  return nextSession;
}

export async function logStimulationSet(draft: StimulationSetDraft): Promise<StimulationSet> {
  if (window.emdr) {
    return window.emdr.request<StimulationSet>("stimulation-set:log", draft);
  }

  const database = await loadDatabase();
  const session = requireLocalSession(database, draft.sessionId);
  const set = createLocalStimulationSet({
    ...draft,
    setNumber: session.stimulationSets.length + 1
  });
  const nextSession = { ...session, stimulationSets: session.stimulationSets.concat(set) };
  await saveDatabase({
    ...database,
    sessions: database.sessions.map((item) => (item.id === session.id ? nextSession : item))
  });
  return set;
}

export async function updateBilateralStimulationSettings(
  patch: Partial<BilateralStimulationSettings>
): Promise<BilateralStimulationSettings> {
  if (window.emdr) {
    return window.emdr.request<BilateralStimulationSettings>("settings:update-bilateral-stimulation", patch);
  }

  const database = await loadDatabase();
  const updated = {
    ...database.settings.bilateralStimulation,
    ...patch
  };
  await saveDatabase({
    ...database,
    settings: {
      ...database.settings,
      bilateralStimulation: updated
    }
  });
  return updated;
}

function emptyDatabase(): Database {
  return {
    targets: [],
    sessions: [],
    settings: {
      bilateralStimulation: {
        speed: 1,
        dotSize: "medium",
        dotColor: "green"
      }
    }
  };
}

function currentTargets(targets: Target[]) {
  return targets
    .filter((target) => target.isCurrent)
    .sort((a, b) => (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1));
}

function createLocalTarget(draft: TargetDraft): Target {
  const createdAt = nowIso();
  return {
    id: createId("tgt"),
    isCurrent: true,
    createdAt,
    updatedAt: createdAt,
    description: draft.description,
    negativeCognition: draft.negativeCognition,
    positiveCognition: draft.positiveCognition,
    clusterTag: draft.clusterTag,
    initialDisturbance: draft.initialDisturbance,
    currentDisturbance: draft.currentDisturbance ?? draft.initialDisturbance,
    status: draft.status ?? "active",
    notes: draft.notes
  };
}

function createLocalTargetRevision(previous: Target, patch: Partial<Target>): Target {
  return {
    ...previous,
    ...patch,
    id: createId("tgt"),
    parentId: previous.parentId ?? previous.id,
    isCurrent: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function createLocalSession(target: Target): SessionAggregate {
  return {
    id: createId("ses"),
    targetId: target.id,
    startedAt: nowIso(),
    assessment: {
      negativeCognition: target.negativeCognition,
      positiveCognition: target.positiveCognition,
      disturbance: target.currentDisturbance
    },
    stimulationSets: []
  };
}

function createLocalStimulationSet(draft: StimulationSetDraft & { setNumber: number }): StimulationSet {
  return {
    id: createId("set"),
    sessionId: draft.sessionId,
    setNumber: draft.setNumber,
    createdAt: nowIso(),
    cycleCount: draft.cycleCount,
    observation: draft.observation,
    disturbance: draft.disturbance
  };
}

function requireLocalSession(database: Database, sessionId: string) {
  const session = database.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
}
