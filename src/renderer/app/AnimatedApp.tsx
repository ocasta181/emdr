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
import { TargetsPanel } from "../features/target/TargetsPanel";
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
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
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

  function resetTransientRendererState() {
    dispatchRoomEvent({ type: "reset_room" });
    setEditingTarget(null);
    setGuideAnimation({ type: "action", action: "speak" });
    setGuideProposals([]);
    setChatDraft("");
    setChatMessages([]);
  }

  async function addTarget() {
    const target = await createTargetRecord({
      description: "New target",
      negativeCognition: "",
      positiveCognition: "",
      status: "active"
    });
    await refreshViewData();
    await refreshGuideView(activeSession?.id);
    setEditingTarget(target);
  }

  async function saveTarget(target: Target) {
    if (!editingTarget) return;
    await reviseTargetRecord(editingTarget.id, targetPatchFrom(target));
    await refreshViewData();
    await refreshGuideView(activeSession?.id);
    setEditingTarget(null);
  }

  async function startSession(target: Target) {
    if (sessionWorkflow.state === "idle" || sessionWorkflow.state === "post_session") {
      setSessionWorkflow(await advanceSessionFlow("start_session"));
    }
    const session = await startSessionRecord(target.id);
    const workflow = await getSessionWorkflow();
    await refreshViewData();
    setActiveSession(session);
    setSessionWorkflow(workflow);
    setEditingTarget(null);
    await refreshGuideView(session.id);
    dispatchRoomEvent({ type: "select_guide" });
    setGuideAnimation({ type: "action", action: "speak" });
    setChatMessages([]);
    setGuideProposals([]);
  }

  async function endActiveSession() {
    if (!activeSession) return;
    if (sessionWorkflow.state !== "review") {
      throw new Error(`Cannot end a session from ${sessionWorkflow.state}.`);
    }
    const result = await applyGuideAction({
      type: "end_session",
      sessionId: activeSession.id,
      workflowState: sessionWorkflow.state
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
      if (activeSession) {
        setSessionWorkflow(await advanceSessionForStimulationStart(activeSession.id, sessionWorkflow));
      }
      dispatchRoomEvent({ type: "start_stimulation" });
    }
  }

  async function pauseActiveStimulation() {
    await logStimulationSetIfActive();
    if (activeSession) {
      setSessionWorkflow(await advanceSessionFlow("pause_stimulation", activeSession.id));
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
    const result = await applyGuideAction(proposal);
    if (!result.accepted) {
      setSessionWorkflow(result.workflow);
      throw new Error(result.reason);
    }

    setGuideProposals((current) => current.filter((item) => item !== proposal));

    if (proposal.type === "end_session") {
      setSessionWorkflow(await advanceSessionFlow("return_to_idle", proposal.sessionId));
      await refreshViewData();
      await refreshGuideView();
      setActiveSession(null);
      setGuideProposals([]);
      return;
    }

    setSessionWorkflow(result.workflow);
    const nextViewData = await refreshViewData();
    setActiveSession(nextViewData.sessions.find((session) => session.id === proposal.sessionId) ?? activeSession);
    await refreshGuideView(proposal.sessionId);
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
  const targets = viewData.targets;
  const sessionsByTargetId = new Map(viewData.targets.map((target) => [target.id, target] as const));
  const sessionHistory = [...viewData.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const allTargets = viewData.allTargets;
  const canToggleStimulation = Boolean(
    activeSession && (stimulationRunning || ["stimulation", "interjection", "closure"].includes(sessionWorkflow.state))
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
              ? `Session in progress · ${sessionsByTargetId.get(activeSession.targetId)?.description ?? "Unknown target"}`
              : "Animated room"}
          </div>
        </div>
        <div className="buttonRow">
          <button onClick={() => void openGuidePanel()}>Guide</button>
          <button onClick={toggleStimulation} disabled={!canToggleStimulation}>
            {stimulationButtonLabel(sessionWorkflow, stimulationRunning)}
          </button>
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
                  targetDescription={sessionsByTargetId.get(activeSession.targetId)?.description}
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
                  onContinueStimulation={() => void advanceActiveSessionWorkflow("continue_stimulation")}
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
              onEdit={setEditingTarget}
              onCancelEdit={() => setEditingTarget(null)}
              onSave={saveTarget}
              onStartSession={startSession}
              onAnimate={(action) => setGuideAnimation({ type: "action", action })}
              isAnimating={(action) => isGuideAnimationAction(guideAnimation, action)}
            />
          )}

          {panel === "history" && (
            <HistoryPanel
              sessions={sessionHistory}
              targetById={new Map(allTargets.map((target) => [target.id, target]))}
            />
          )}

          {panel === "settings" && (
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onExport={exportEncryptedData}
              onImport={importEncryptedData}
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
