import type {
  BilateralStimulationSettings,
  GuideActionProposal,
  GuideActionResult,
  GuideAgentResponse,
  GuideView,
  SessionAggregate,
  SessionFlowAction,
  SessionWorkflowSnapshot,
  Settings,
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

export async function listTargets(): Promise<Target[]> {
  return emdr().request<Target[]>("target:list");
}

export async function listAllTargets(): Promise<Target[]> {
  return emdr().request<Target[]>("target:list-all");
}

export async function listSessions(): Promise<SessionAggregate[]> {
  return emdr().request<SessionAggregate[]>("session:list");
}

export async function getSettings(): Promise<Settings> {
  return emdr().request<Settings>("settings:get");
}

export async function getGuideView(activeSessionId?: string): Promise<GuideView> {
  return emdr().request<GuideView>("guide:view", activeSessionId ? { activeSessionId } : undefined);
}

export async function sendGuideMessage(message: string, activeSessionId?: string): Promise<GuideAgentResponse> {
  return emdr().request<GuideAgentResponse>("guide:message", { activeSessionId, message });
}

export async function getSessionWorkflow(): Promise<SessionWorkflowSnapshot> {
  return emdr().request<SessionWorkflowSnapshot>("session:workflow");
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

export async function advanceSessionFlow(
  action: SessionFlowAction,
  sessionId?: string
): Promise<SessionWorkflowSnapshot> {
  return emdr().request<SessionWorkflowSnapshot>("session:advance-flow", { sessionId, action });
}

export async function applyGuideAction(proposal: GuideActionProposal): Promise<GuideActionResult> {
  return emdr().request<GuideActionResult>("guide:apply-action", proposal);
}

export async function updateBilateralStimulationSettings(
  patch: Partial<BilateralStimulationSettings>
): Promise<BilateralStimulationSettings> {
  return emdr().request<BilateralStimulationSettings>("settings:update-bilateral-stimulation", patch);
}

function emdr() {
  if (!window.emdr) {
    throw new Error("EMDR bridge is unavailable.");
  }
  return window.emdr;
}
