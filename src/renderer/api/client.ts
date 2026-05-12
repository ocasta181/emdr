import type {
  BilateralStimulationSettings,
  Database,
  SessionAggregate,
  SessionEndPatch,
  StimulationSet,
  StimulationSetDraft,
  Target,
  TargetDraft
} from "../../shared/types";

export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export async function getVaultStatus(): Promise<VaultStatus> {
  return emdr().request<VaultStatus>("vault:status");
}

export async function createVault(password: string) {
  return emdr().request<{ recoveryCode: string }>("vault:create", password);
}

export async function unlockWithPassword(password: string) {
  await emdr().request("vault:unlock-password", password);
}

export async function unlockWithRecoveryCode(recoveryCode: string) {
  await emdr().request("vault:unlock-recovery", recoveryCode);
}

export async function exportVault() {
  return emdr().request<{ canceled: true } | { canceled: false; path: string }>("vault:export");
}

export async function importVault() {
  return emdr().request<{ canceled: boolean }>("vault:import");
}

export async function loadDatabase(): Promise<Database> {
  const loaded = await emdr().request<unknown | null>("legacy:load-database");
  return loaded ? (loaded as Database) : emptyDatabase();
}

export async function saveDatabase(database: Database) {
  await emdr().request("legacy:save-database", database);
}

export async function listTargets(): Promise<Target[]> {
  return emdr().request<Target[]>("target:list");
}

export async function createTarget(draft: TargetDraft): Promise<Target> {
  return emdr().request<Target>("target:create", draft);
}

export async function reviseTarget(previousId: string, patch: Partial<Target>): Promise<Target> {
  return emdr().request<Target>("target:revise", { previousId, patch });
}

export async function startSession(targetId: string): Promise<SessionAggregate> {
  return emdr().request<SessionAggregate>("session:start", { targetId });
}

export async function updateSessionAssessment(sessionId: string, assessment: SessionAggregate["assessment"]) {
  return emdr().request<SessionAggregate>("session:update-assessment", { sessionId, assessment });
}

export async function endSession(patch: SessionEndPatch): Promise<SessionAggregate> {
  return emdr().request<SessionAggregate>("session:end", patch);
}

export async function logStimulationSet(draft: StimulationSetDraft): Promise<StimulationSet> {
  return emdr().request<StimulationSet>("stimulation-set:log", draft);
}

export async function updateBilateralStimulationSettings(
  patch: Partial<BilateralStimulationSettings>
): Promise<BilateralStimulationSettings> {
  return emdr().request<BilateralStimulationSettings>("settings:update-bilateral-stimulation", patch);
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

function emdr() {
  if (!window.emdr) {
    throw new Error("EMDR bridge is unavailable.");
  }
  return window.emdr;
}
