import { useEffect, useReducer, useState, type FormEvent } from "react";
import { RoomScene, type RoomObjectId } from "../animation/RoomScene";
import type { GuideAction, GuideAnimationIntent } from "../animation/guideAnimationModel";
import {
  advanceSessionFlow,
  applyGuideAction,
  createTarget as createTargetRecord,
  createVault,
  exportVault,
  getGuideView,
  getSettings,
  getSessionWorkflow,
  getVaultStatus,
  importVault,
  listAllTargets,
  listSessions,
  listTargets,
  lockVault,
  reviseTarget as reviseTargetRecord,
  sendGuideMessage,
  startSession as startSessionRecord,
  unlockWithPassword,
  unlockWithRecoveryCode,
  updateBilateralStimulationSettings,
  updateSessionAssessment,
  type VaultStatus
} from "../api/client";
import type {
  Assessment,
  BilateralStimulationSettings,
  GuideActionProposal,
  GuideView,
  SessionAggregate,
  SessionFlowAction,
  SessionWorkflowSnapshot,
  Settings,
  Target
} from "../../shared/types";
import {
  animatedPanelForState,
  animatedRoomStimulationRunning,
  initialAnimatedRoomState,
  transitionAnimatedRoomState
} from "./animatedRoomMachine";
import { ActiveSessionChat, IdleGuideChat } from "../features/guide/GuidePanel";
import { HistoryPanel } from "../features/session/HistoryPanel";
import { SettingsPanel } from "../features/setting/SettingsPanel";
import { TargetsPanel, type TargetEditorState } from "../features/target/TargetsPanel";
import { RecoveryCode, VaultSetup, VaultUnlock } from "../features/vault/VaultAccess";

type AuthState = "checking" | "setup" | "recovery" | "locked" | "ready";

type AppViewData = {
  targets: Target[];
  allTargets: Target[];
  sessions: SessionAggregate[];
  settings: Settings;
};

const dotColorHex: Record<BilateralStimulationSettings["dotColor"], string> = {
  green: "#6dd07a",
  blue: "#6ec1e4",
  white: "#f3f3f3",
  orange: "#ff9b50"
};

const emptyViewData: AppViewData = {
  targets: [],
  allTargets: [],
  sessions: [],
  settings: {
    bilateralStimulation: {
      speed: 1,
      dotSize: "medium",
      dotColor: "green"
    }
  }
};

export function AnimatedApp() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [viewData, setViewData] = useState<AppViewData>(emptyViewData);
  const [roomState, dispatchRoomEvent] = useReducer(transitionAnimatedRoomState, initialAnimatedRoomState);
  const [guideAnimation, setGuideAnimation] = useState<GuideAnimationIntent>({ type: "action", action: "speak" });
  const [editingTarget, setEditingTarget] = useState<TargetEditorState | null>(null);
  const [activeSession, setActiveSession] = useState<SessionAggregate | null>(null);
  const [sessionWorkflow, setSessionWorkflow] = useState<SessionWorkflowSnapshot>({ state: "idle" });
  const [guideView, setGuideView] = useState<GuideView | null>(null);
  const [guideProposals, setGuideProposals] = useState<GuideActionProposal[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [vaultNotice, setVaultNotice] = useState("");

  useEffect(() => {
    getVaultStatus().then((status) => {
      if (status === "unlocked") {
        void loadUnlockedDatabase();
      } else {
        setAuthState(authStateForVault(status));
      }
    });
  }, []);

  async function loadUnlockedDatabase() {
    const [nextViewData, workflow] = await Promise.all([loadViewData(), getSessionWorkflow()]);
    const restoredActiveSession = activeSessionFromWorkflow(nextViewData.sessions, workflow);
    const nextGuideView = await getGuideView(restoredActiveSession?.id);
    resetTransientRendererState();
    setViewData(nextViewData);
    setActiveSession(restoredActiveSession);
    setSessionWorkflow(workflow);
    setGuideView(nextGuideView);
    setVaultNotice("");
    setAuthState("ready");
  }

  async function refreshViewData() {
    const nextViewData = await loadViewData();
    setViewData(nextViewData);
    return nextViewData;
  }

  async function refreshGuideView(activeSessionId?: string) {
    const nextGuideView = await getGuideView(activeSessionId);
    setGuideView(nextGuideView);
    return nextGuideView;
  }

  async function setupVault(password: string) {
    const result = await createVault(password);
    setRecoveryCode(result.recoveryCode);
    setAuthState("recovery");
  }

  async function unlockVault(password: string) {
    await unlockWithPassword(password);
    await loadUnlockedDatabase();
  }

  async function unlockVaultWithRecovery(code: string) {
    await unlockWithRecoveryCode(code);
    await loadUnlockedDatabase();
  }

  async function exportEncryptedData() {
    const result = await exportVault();
    return result.canceled ? undefined : result.path;
  }

  async function importEncryptedData() {
    const result = await importVault();
    if (result.canceled) return false;
    resetTransientRendererState();
    setViewData(emptyViewData);
    setSessionWorkflow({ state: "idle" });
    setActiveSession(null);
    setGuideView(null);
    setVaultNotice("Encrypted data imported. Unlock to continue.");
    setAuthState("locked");
    return true;
  }

  async function lockEncryptedData() {
    await lockVault();
    resetTransientRendererState();
    setViewData(emptyViewData);
    setSessionWorkflow({ state: "idle" });
    setActiveSession(null);
    setGuideView(null);
    setVaultNotice("Encrypted data locked.");
    setAuthState("locked");
  }

  function resetTransientRendererState() {
    dispatchRoomEvent({ type: "reset_room" });
    setEditingTarget(null);
    setGuideAnimation({ type: "action", action: "speak" });
    setGuideProposals([]);
    setChatDraft("");
    setChatMessages([]);
  }

  function addTarget() {
    setEditingTarget({
      kind: "new",
      draft: {
        description: "",
        negativeCognition: "",
        positiveCognition: "",
        status: "active"
      }
    });
  }

  async function saveTarget(target: TargetEditorState) {
    if (target.kind === "new") {
      await createTargetRecord(target.draft);
    } else {
      await reviseTargetRecord(target.target.id, targetPatchFrom(target.target));
    }
    await refreshViewData();
    await refreshGuideView(activeSession?.id);
    setEditingTarget(null);
  }

  async function beginSession(target: Target) {
    if (sessionWorkflow.state === "idle" || sessionWorkflow.state === "post_session") {
      setSessionWorkflow(await advanceSessionFlow("start_session"));
    }
    const session = await startSessionRecord(target.id);
    const workflow = await getSessionWorkflow();
    const nextViewData = await refreshViewData();
    const nextSession = nextViewData.sessions.find((item) => item.id === session.id) ?? session;
    setActiveSession(nextSession);
    setSessionWorkflow(workflow);
    setEditingTarget(null);
    await refreshGuideView(session.id);
    setGuideProposals([]);
    return { session: nextSession, workflow };
  }

  async function endActiveSession(patch: { finalDisturbance?: number; notes?: string } = {}) {
    if (!activeSession) return;
    if (sessionWorkflow.state !== "review") {
      throw new Error(`Cannot end a session from ${sessionWorkflow.state}.`);
    }
    const result = await applyGuideAction({
      type: "end_session",
      sessionId: activeSession.id,
      workflowState: sessionWorkflow.state,
      finalDisturbance: patch.finalDisturbance,
      notes: patch.notes
    });
    if (!result.accepted) {
      setSessionWorkflow(result.workflow);
      throw new Error(result.reason);
    }
    setSessionWorkflow(await advanceSessionFlow("return_to_idle", activeSession.id));
    await refreshViewData();
    await refreshGuideView();
    setActiveSession(null);
    setGuideProposals([]);
    if (stimulationRunning) {
      dispatchRoomEvent({ type: "pause_stimulation" });
    }
  }

  async function saveSessionAssessment(assessment: Assessment) {
    if (!activeSession) return;
    setGuideProposals([]);
    const session = await updateSessionAssessment(activeSession.id, assessment);
    setActiveSession(session);
    await refreshViewData();
    setSessionWorkflow(await getSessionWorkflow());
    await refreshGuideView(session.id);
  }

  async function approveSessionAssessment(assessment: Assessment) {
    if (!activeSession) return;
    setGuideProposals([]);
    const session = await updateSessionAssessment(activeSession.id, assessment);
    setActiveSession(session);
    await refreshViewData();
    setSessionWorkflow(await advanceSessionFlow("approve_assessment", session.id));
    await refreshGuideView(session.id);
  }

  async function advanceActiveSessionWorkflow(action: SessionFlowAction) {
    if (!activeSession) return;
    setGuideProposals([]);
    if (stimulationRunning && (action === "begin_closure" || action === "request_grounding")) {
      await logStimulationSetIfActive();
      dispatchRoomEvent({ type: "pause_stimulation" });
    }
    setSessionWorkflow(await advanceSessionFlow(action, activeSession.id));
    await refreshGuideView(activeSession.id);
  }

  async function updateSettings(patch: Partial<BilateralStimulationSettings>) {
    await updateBilateralStimulationSettings(patch);
    await refreshViewData();
  }

  function selectObject(objectId: RoomObjectId) {
    if (objectId === "guide") {
      void openGuidePanel();
      return;
    }
    if (objectId === "targets") {
      dispatchRoomEvent({ type: "select_targets" });
      setGuideAnimation({ type: "book_state", bookState: "in_hand_open" });
      return;
    }
    setGuideAnimation(
      objectId === "history" ? { type: "action", action: "think" } : { type: "book_state", bookState: "on_ground" }
    );
    dispatchRoomEvent({ type: objectId === "settings" ? "select_settings" : "select_history" });
  }

  async function openGuidePanel() {
    if (stimulationRunning) {
      await pauseActiveStimulation();
    }
    dispatchRoomEvent({ type: "select_guide" });
    setGuideAnimation({ type: "action", action: "speak" });
  }

  async function toggleStimulation() {
    setGuideProposals([]);
    if (stimulationRunning) {
      await pauseActiveStimulation();
    } else {
      let session = activeSession;
      let workflow = sessionWorkflow;
      if (!session) {
        const target = targets[0];
        if (!target) return;
        const started = await beginSession(target);
        session = started.session;
        workflow = started.workflow;
      }
      setSessionWorkflow(await advanceSessionForStimulationStart(session.id, workflow));
      await refreshGuideView(session.id);
      dispatchRoomEvent({ type: "start_stimulation" });
    }
  }

  async function pauseActiveStimulation() {
    await logStimulationSetIfActive();
    if (activeSession) {
      const workflow = await advanceSessionFlow("pause_stimulation", activeSession.id);
      setSessionWorkflow(workflow);
      await refreshGuideView(activeSession.id);
    }
    dispatchRoomEvent({ type: "pause_stimulation" });
  }

  async function logStimulationSetIfActive() {
    if (!activeSession) return;
    const result = await applyGuideAction({
      type: "log_stimulation_set",
      sessionId: activeSession.id,
      workflowState: sessionWorkflow.state,
      cycleCount: 24,
      observation: ""
    });
    if (!result.accepted) {
      setSessionWorkflow(result.workflow);
      throw new Error(result.reason);
    }
    setSessionWorkflow(result.workflow);
    setGuideProposals([]);
    const nextViewData = await refreshViewData();
    setActiveSession(nextViewData.sessions.find((session) => session.id === activeSession.id) ?? activeSession);
    await refreshGuideView(activeSession.id);
  }

  function closePanel() {
    dispatchRoomEvent({ type: "close_panel" });
  }

  async function applyAgentProposal(proposal: GuideActionProposal) {
    if (
      proposal.type === "advance_session_flow" &&
      stimulationRunning &&
      activeSession?.id === proposal.sessionId &&
      sessionWorkflow.state === proposal.workflowState &&
      (proposal.action === "begin_closure" || proposal.action === "request_grounding")
    ) {
      await logStimulationSetIfActive();
      dispatchRoomEvent({ type: "pause_stimulation" });
    }

    const result = await applyGuideAction(proposal);
    if (!result.accepted) {
      setSessionWorkflow(result.workflow);
      throw new Error(result.reason);
    }

    setGuideProposals([]);

    if (proposal.type === "end_session") {
      setSessionWorkflow(await advanceSessionFlow("return_to_idle", proposal.sessionId));
      await refreshViewData();
      await refreshGuideView();
      setActiveSession(null);
      setGuideProposals([]);
      return;
    }

    if (proposal.type === "create_target_draft") {
      setSessionWorkflow(result.workflow);
      await refreshViewData();
      await refreshGuideView(activeSession?.id);
      return;
    }

    if (proposal.type === "log_stimulation_set" && stimulationRunning) {
      dispatchRoomEvent({ type: "pause_stimulation" });
    }

    setSessionWorkflow(result.workflow);
    const nextViewData = await refreshViewData();
    if ("sessionId" in proposal) {
      setActiveSession(nextViewData.sessions.find((session) => session.id === proposal.sessionId) ?? activeSession);
      await refreshGuideView(proposal.sessionId);
    }
  }

  async function submitChat(event: FormEvent) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message) return;
    setChatMessages((current) => current.concat(message));
    setChatDraft("");
    try {
      const response = await sendGuideMessage(message, activeSession?.id);
      setChatMessages((current) => current.concat(response.messages));
      setGuideProposals(response.proposals);
    } catch {
      setChatMessages((current) => current.concat("The local guide is unavailable right now."));
      setGuideProposals([]);
    }
  }

  function handleGuideActionComplete(action: GuideAction) {
    if (action === "flip_through_book" || action === "write_in_book") {
      setGuideAnimation({ type: "book_state", bookState: "in_hand_open" });
    }
  }

  if (authState === "checking") {
    return <div className="boot">Loading local data...</div>;
  }

  if (authState === "setup") {
    return <VaultSetup onCreate={setupVault} onImport={importEncryptedData} />;
  }

  if (authState === "recovery") {
    return <RecoveryCode recoveryCode={recoveryCode} onContinue={loadUnlockedDatabase} />;
  }

  if (authState === "locked") {
    return (
      <VaultUnlock
        onUnlock={unlockVault}
        onRecoveryUnlock={unlockVaultWithRecovery}
        onImport={importEncryptedData}
        notice={vaultNotice}
      />
    );
  }

  const panel = animatedPanelForState(roomState);
  const stimulationRunning = animatedRoomStimulationRunning(roomState);

  if (!guideView) {
    return <div className="boot">Loading local data...</div>;
  }

  const panelClass = panel ? `animatedPanel animatedPanel-${panel}` : "animatedPanel";
  const settings = viewData.settings.bilateralStimulation;
  const allTargets = viewData.allTargets;
  const targetById = new Map(allTargets.map((target) => [target.id, target] as const));
  const targets = guideOrderedTargets(viewData.targets, targetById, viewData.sessions);
  const sessionHistory = [...viewData.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const canStartSetFromTarget = Boolean(
    !activeSession && targets.length > 0 && ["idle", "target_selection", "post_session"].includes(sessionWorkflow.state)
  );
  const canToggleStimulation = Boolean(
    canStartSetFromTarget ||
      (activeSession &&
        (stimulationRunning || ["preparation", "stimulation", "interjection", "closure"].includes(sessionWorkflow.state)))
  );

  return (
    <div className={stimulationRunning ? "animatedApp stimulationActive" : "animatedApp"}>
      <RoomScene
        mode={stimulationRunning ? "stimulation" : panel === "chat" ? "chat" : "idle"}
        guideAnimation={guideAnimation}
        stimulationRunning={stimulationRunning}
        stimulationColor={dotColorHex[settings.dotColor]}
        stimulationSpeed={settings.speed}
        onObjectSelected={selectObject}
        onGuideActionComplete={handleGuideActionComplete}
      />

      <header className="animatedTopbar">
        <div>
          <div className="brand">EMDR Local</div>
          <div className="subtle">
            {activeSession
              ? `Session in progress · ${targetById.get(activeSession.targetId)?.description ?? "Unknown target"}`
              : "Animated room"}
          </div>
        </div>
        <div className="buttonRow">
          <button onClick={() => void openGuidePanel()}>Guide</button>
          {canToggleStimulation && (
            <button onClick={toggleStimulation}>{stimulationButtonLabel(sessionWorkflow, stimulationRunning)}</button>
          )}
          {stimulationRunning && (
            <button onClick={() => dispatchRoomEvent({ type: "select_settings" })}>Ball settings</button>
          )}
        </div>
      </header>

      {panel && (
        <aside className={panelClass}>
          <button className="panelClose" aria-label="Close panel" onClick={closePanel}>
            Close
          </button>
          {panel === "chat" && (
            <>
              <h1>Guide</h1>
              {activeSession ? (
                <ActiveSessionChat
                  session={activeSession}
                  targetDescription={targetById.get(activeSession.targetId)?.description}
                  guideView={guideView}
                  workflow={sessionWorkflow}
                  chatMessages={chatMessages}
                  chatDraft={chatDraft}
                  guideProposals={guideProposals}
                  onChatChange={setChatDraft}
                  onSubmitChat={submitChat}
                  onApplyProposal={applyAgentProposal}
                  onSaveAssessment={saveSessionAssessment}
                  onApproveAssessment={approveSessionAssessment}
                  onStartSet={() => void toggleStimulation()}
                  onRequestGrounding={() => void advanceActiveSessionWorkflow("request_grounding")}
                  onBeginClosure={() => void advanceActiveSessionWorkflow("begin_closure")}
                  onRequestReview={() => void advanceActiveSessionWorkflow("request_review")}
                  onEndSession={endActiveSession}
                />
              ) : (
                <IdleGuideChat
                  guideView={guideView}
                  onOpenTargets={() => {
                    dispatchRoomEvent({ type: "select_targets" });
                    setGuideAnimation({ type: "book_state", bookState: "in_hand_open" });
                  }}
                />
              )}
            </>
          )}

          {panel === "targets" && (
            <TargetsPanel
              targets={targets}
              editing={editingTarget}
              activeSessionTargetId={activeSession?.targetId}
              onAdd={addTarget}
              onEdit={(target) => setEditingTarget({ kind: "existing", target })}
              onCancelEdit={() => setEditingTarget(null)}
              onSave={saveTarget}
              onAnimate={(action) => setGuideAnimation({ type: "action", action })}
              isAnimating={(action) => isGuideAnimationAction(guideAnimation, action)}
            />
          )}

          {panel === "history" && (
            <HistoryPanel
              sessions={sessionHistory}
              targetById={targetById}
            />
          )}

          {panel === "settings" && (
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onExport={exportEncryptedData}
              onImport={importEncryptedData}
              onLock={lockEncryptedData}
            />
          )}
        </aside>
      )}
    </div>
  );
}

async function loadViewData(): Promise<AppViewData> {
  const [targets, allTargets, sessions, settings] = await Promise.all([
    listTargets(),
    listAllTargets(),
    listSessions(),
    getSettings()
  ]);
  return { targets, allTargets, sessions, settings };
}

function activeSessionFromWorkflow(sessions: SessionAggregate[], workflow: SessionWorkflowSnapshot) {
  return workflow.activeSessionId
    ? sessions.find((session) => session.id === workflow.activeSessionId && !session.endedAt) ?? null
    : null;
}

function guideOrderedTargets(
  currentTargets: Target[],
  targetById: Map<string, Target>,
  sessions: SessionAggregate[]
): Target[] {
  const latestWorkByTargetId = new Map<string, string>();

  for (const target of currentTargets) {
    if (target.status !== "active") continue;
    const targetIds = targetLineageIds(target, targetById);
    const latestSession = sessions
      .filter((session) => targetIds.has(session.targetId))
      .sort((a, b) => sessionWorkTime(b).localeCompare(sessionWorkTime(a)))[0];
    if (latestSession) {
      latestWorkByTargetId.set(target.id, sessionWorkTime(latestSession));
    }
  }

  return currentTargets
    .filter((target) => target.status === "active")
    .sort((a, b) => {
      const aWorkedAt = latestWorkByTargetId.get(a.id);
      const bWorkedAt = latestWorkByTargetId.get(b.id);
      if (aWorkedAt && bWorkedAt && aWorkedAt !== bWorkedAt) return bWorkedAt.localeCompare(aWorkedAt);
      if (aWorkedAt && !bWorkedAt) return -1;
      if (!aWorkedAt && bWorkedAt) return 1;
      const disturbanceDelta = (b.currentDisturbance ?? -1) - (a.currentDisturbance ?? -1);
      if (disturbanceDelta !== 0) return disturbanceDelta;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

function targetLineageIds(target: Target, targetById: Map<string, Target>) {
  const ids = new Set<string>();
  let current: Target | undefined = target;
  while (current) {
    ids.add(current.id);
    current = current.parentId ? targetById.get(current.parentId) : undefined;
  }
  return ids;
}

function sessionWorkTime(session: SessionAggregate) {
  return session.endedAt ?? session.startedAt;
}

function stimulationButtonLabel(workflow: SessionWorkflowSnapshot, running: boolean) {
  if (running) return "Pause Set";
  if (workflow.state === "interjection" || workflow.state === "closure") return "Continue Set";
  return "Start Set";
}

async function advanceSessionForStimulationStart(sessionId: string, workflow: SessionWorkflowSnapshot) {
  if (workflow.state === "preparation") {
    return advanceSessionFlow("approve_assessment", sessionId);
  }
  if (workflow.state === "stimulation") {
    return advanceSessionFlow("start_stimulation", sessionId);
  }
  if (workflow.state === "interjection" || workflow.state === "closure") {
    return advanceSessionFlow("continue_stimulation", sessionId);
  }
  throw new Error(`Cannot start stimulation from ${workflow.state}.`);
}

function isGuideAnimationAction(intent: GuideAnimationIntent, action: GuideAction) {
  return intent.type === "action" && intent.action === action;
}

function targetPatchFrom(target: Target): Partial<Target> {
  return {
    description: target.description,
    negativeCognition: target.negativeCognition,
    positiveCognition: target.positiveCognition,
    clusterTag: target.clusterTag,
    initialDisturbance: target.initialDisturbance,
    currentDisturbance: target.currentDisturbance,
    status: target.status,
    notes: target.notes
  };
}

function authStateForVault(status: VaultStatus): AuthState {
  if (status === "setupRequired") return "setup";
  if (status === "locked") return "locked";
  return "ready";
}
