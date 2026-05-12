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
  GuideView,
  SessionAggregate,
  SessionFlowAction,
  SessionWorkflowSnapshot,
  Settings,
  Target,
  TargetStatus
} from "../../shared/types";
import { optionalNumber } from "../../../utils";
import {
  animatedPanelForState,
  animatedRoomStimulationRunning,
  initialAnimatedRoomState,
  transitionAnimatedRoomState
} from "./animatedRoomMachine";
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
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>([]);

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
    setViewData(nextViewData);
    setActiveSession(restoredActiveSession);
    setSessionWorkflow(workflow);
    setGuideView(nextGuideView);
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
    setActiveSession(null);
    setSessionWorkflow({ state: "idle" });
    setEditingTarget(null);
    setGuideView(null);
    setAuthState("locked");
    return true;
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
    if (stimulationRunning) {
      dispatchRoomEvent({ type: "pause_stimulation" });
    }
  }

  async function saveSessionAssessment(assessment: Assessment) {
    if (!activeSession) return;
    const session = await updateSessionAssessment(activeSession.id, assessment);
    setActiveSession(session);
    await refreshViewData();
    setSessionWorkflow(await getSessionWorkflow());
    await refreshGuideView(session.id);
  }

  async function approveSessionAssessment(assessment: Assessment) {
    if (!activeSession) return;
    const session = await updateSessionAssessment(activeSession.id, assessment);
    setActiveSession(session);
    await refreshViewData();
    setSessionWorkflow(await advanceSessionFlow("approve_assessment", session.id));
    await refreshGuideView(session.id);
  }

  async function advanceActiveSessionWorkflow(action: SessionFlowAction) {
    if (!activeSession) return;
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
      dispatchRoomEvent({ type: "select_guide" });
      setGuideAnimation({ type: "action", action: "speak" });
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

  async function toggleStimulation() {
    if (stimulationRunning) {
      await logStimulationSetIfActive();
      if (activeSession) {
        setSessionWorkflow(await advanceSessionFlow("pause_stimulation", activeSession.id));
      }
      dispatchRoomEvent({ type: "pause_stimulation" });
    } else {
      if (activeSession) {
        setSessionWorkflow(await advanceSessionForStimulationStart(activeSession.id, sessionWorkflow));
      }
      dispatchRoomEvent({ type: "start_stimulation" });
    }
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
    const nextViewData = await refreshViewData();
    setActiveSession(nextViewData.sessions.find((session) => session.id === activeSession.id) ?? activeSession);
    await refreshGuideView(activeSession.id);
  }

  function closePanel() {
    dispatchRoomEvent({ type: "close_panel" });
  }

  function submitChat(event: FormEvent) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message) return;
    setChatMessages((current) => current.concat(message));
    setChatDraft("");
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
          <button
            onClick={() => {
              dispatchRoomEvent({ type: "select_guide" });
              setGuideAnimation({ type: "action", action: "speak" });
            }}
          >
            Guide
          </button>
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
                  onChatChange={setChatDraft}
                  onSubmitChat={submitChat}
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

function IdleGuideChat({ guideView, onOpenTargets }: { guideView: GuideView; onOpenTargets: () => void }) {
  return (
    <div className="chatLog">
      {guideView.messages.map((message, index) => (
        <p className="guideBubble" key={`${message}-${index}`}>
          {message}
        </p>
      ))}
      {guideView.primaryAction?.type === "open_targets" && (
        <button onClick={onOpenTargets}>{guideView.primaryAction.label}</button>
      )}
    </div>
  );
}

function ActiveSessionChat({
  session,
  targetDescription,
  guideView,
  workflow,
  chatMessages,
  chatDraft,
  onChatChange,
  onSubmitChat,
  onSaveAssessment,
  onApproveAssessment,
  onContinueStimulation,
  onRequestGrounding,
  onBeginClosure,
  onRequestReview,
  onEndSession
}: {
  session: SessionAggregate;
  targetDescription?: string;
  guideView: GuideView;
  workflow: SessionWorkflowSnapshot;
  chatMessages: string[];
  chatDraft: string;
  onChatChange: (value: string) => void;
  onSubmitChat: (event: FormEvent) => void;
  onSaveAssessment: (assessment: Assessment) => void;
  onApproveAssessment: (assessment: Assessment) => void;
  onContinueStimulation: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
  onEndSession: () => void;
}) {
  const sessionView = guideView.mode === "session" ? guideView.activeSession : undefined;
  const displayTargetDescription = sessionView?.targetDescription ?? targetDescription ?? "Unknown target";
  const setCount = sessionView?.stimulationSetCount ?? session.stimulationSets.length;
  const messages = (guideView.mode === "session" ? guideView.messages : []).concat(chatMessages);
  const workflowState = sessionView?.workflowState ?? workflow.state;

  return (
    <>
      <p className="authNotice">
        {displayTargetDescription} · {workflowLabel(workflowState)} · {setCount} set
        {setCount === 1 ? "" : "s"} logged
      </p>
      {workflowState === "preparation" && (
        <AssessmentForm
          assessment={session.assessment}
          onSave={onSaveAssessment}
          onApprove={onApproveAssessment}
        />
      )}
      {workflowState !== "preparation" && workflowState !== "review" && workflowState !== "post_session" && (
        <WorkflowControls
          workflow={workflowState}
          onContinueStimulation={onContinueStimulation}
          onRequestGrounding={onRequestGrounding}
          onBeginClosure={onBeginClosure}
          onRequestReview={onRequestReview}
        />
      )}
      <div className="chatLog">
        {messages.map((message, index) => (
          <p className="userBubble" key={`${message}-${index}`}>
            {message}
          </p>
        ))}
      </div>
      <form className="chatComposer" onSubmit={onSubmitChat}>
        <label>
          Note
          <textarea
            placeholder="Capture an in-session note..."
            value={chatDraft}
            onChange={(event) => onChatChange(event.target.value)}
          />
        </label>
        <button type="submit">Send</button>
      </form>
      {workflowState === "review" && (
        <div className="buttonRow">
          <button onClick={onEndSession}>End session</button>
          <button onClick={onBeginClosure}>Return to closure</button>
        </div>
      )}
    </>
  );
}

function AssessmentForm({
  assessment,
  onSave,
  onApprove
}: {
  assessment: Assessment;
  onSave: (assessment: Assessment) => void;
  onApprove: (assessment: Assessment) => void;
}) {
  const [draft, setDraft] = useState(assessment);

  useEffect(() => setDraft(assessment), [assessment]);

  function set<K extends keyof Assessment>(key: K, value: Assessment[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="form workflowForm"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label>
        Image
        <textarea value={draft.image ?? ""} onChange={(event) => set("image", event.target.value)} />
      </label>
      <label>
        Negative cognition
        <input
          value={draft.negativeCognition}
          onChange={(event) => set("negativeCognition", event.target.value)}
        />
      </label>
      <label>
        Positive cognition
        <input
          value={draft.positiveCognition}
          onChange={(event) => set("positiveCognition", event.target.value)}
        />
      </label>
      <div className="twoCol">
        <label>
          VOC
          <input
            type="number"
            min="1"
            max="7"
            value={draft.believability ?? ""}
            onChange={(event) => set("believability", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          SUD
          <input
            type="number"
            min="0"
            max="10"
            value={draft.disturbance ?? ""}
            onChange={(event) => set("disturbance", optionalNumber(event.target.value))}
          />
        </label>
      </div>
      <label>
        Emotions
        <input value={draft.emotions ?? ""} onChange={(event) => set("emotions", event.target.value)} />
      </label>
      <label>
        Body location
        <input value={draft.bodyLocation ?? ""} onChange={(event) => set("bodyLocation", event.target.value)} />
      </label>
      <div className="buttonRow">
        <button type="submit">Save assessment</button>
        <button type="button" onClick={() => onApprove(draft)}>
          Approve assessment
        </button>
      </div>
    </form>
  );
}

function WorkflowControls({
  workflow,
  onContinueStimulation,
  onRequestGrounding,
  onBeginClosure,
  onRequestReview
}: {
  workflow: SessionWorkflowSnapshot["state"];
  onContinueStimulation: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
}) {
  return (
    <div className="workflowControls">
      {(workflow === "interjection" || workflow === "closure") && (
        <button onClick={onContinueStimulation}>Continue stimulation</button>
      )}
      {(workflow === "stimulation" || workflow === "closure") && (
        <button onClick={onRequestGrounding}>Grounding</button>
      )}
      {(workflow === "stimulation" || workflow === "interjection") && (
        <button onClick={onBeginClosure}>Begin closure</button>
      )}
      {workflow === "closure" && <button onClick={onRequestReview}>Request review</button>}
    </div>
  );
}

function workflowLabel(state: SessionWorkflowSnapshot["state"]) {
  return state
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function TargetsPanel({
  targets,
  editing,
  activeSessionTargetId,
  onAdd,
  onEdit,
  onCancelEdit,
  onSave,
  onStartSession,
  onAnimate,
  isAnimating
}: {
  targets: Target[];
  editing: Target | null;
  activeSessionTargetId: string | undefined;
  onAdd: () => void;
  onEdit: (target: Target) => void;
  onCancelEdit: () => void;
  onSave: (target: Target) => void;
  onStartSession: (target: Target) => void;
  onAnimate: (action: GuideAction) => void;
  isAnimating: (action: GuideAction) => boolean;
}) {
  return (
    <>
      <div className="panelHeader">
        <h1>Targets</h1>
        <button onClick={onAdd}>New Target</button>
      </div>

      {editing ? (
        <TargetForm
          target={editing}
          onSave={(target) => {
            onAnimate("write_in_book");
            onSave(target);
          }}
          onCancel={onCancelEdit}
        />
      ) : (
        <div className="targetList">
          {targets.length === 0 && <p className="authNotice">No active targets yet.</p>}
          {targets.map((target) => (
            <article className="targetRow" key={target.id}>
              <div>
                <h2>{target.description}</h2>
                <p>
                  {target.status} · {target.clusterTag || "No cluster"}
                </p>
              </div>
              <div className="sud">SUD {target.currentDisturbance ?? "-"}</div>
              <div className="buttonRow">
                <button
                  onClick={() => {
                    onAnimate("flip_through_book");
                    onEdit(target);
                  }}
                >
                  Edit
                </button>
                <button
                  disabled={Boolean(activeSessionTargetId)}
                  onClick={() => onStartSession(target)}
                >
                  {activeSessionTargetId === target.id ? "In session" : "Start session"}
                </button>
              </div>
            </article>
          ))}
          <div className="buttonRow">
            <button
              className={isAnimating("flip_through_book") ? "active" : undefined}
              onClick={() => onAnimate("flip_through_book")}
            >
              Flip pages
            </button>
            <button
              className={isAnimating("write_in_book") ? "active" : undefined}
              onClick={() => onAnimate("write_in_book")}
            >
              Write target
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TargetForm({
  target,
  onSave,
  onCancel
}: {
  target: Target;
  onSave: (target: Target) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(target);

  useEffect(() => setDraft(target), [target]);

  function set<K extends keyof Target>(key: K, value: Target[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label>
        Description
        <textarea value={draft.description} onChange={(event) => set("description", event.target.value)} />
      </label>
      <label>
        Negative cognition
        <input value={draft.negativeCognition} onChange={(event) => set("negativeCognition", event.target.value)} />
      </label>
      <label>
        Positive cognition
        <input value={draft.positiveCognition} onChange={(event) => set("positiveCognition", event.target.value)} />
      </label>
      <label>
        Cluster
        <input value={draft.clusterTag ?? ""} onChange={(event) => set("clusterTag", event.target.value)} />
      </label>
      <div className="twoCol">
        <label>
          Initial SUD
          <input
            type="number"
            min="0"
            max="10"
            value={draft.initialDisturbance ?? ""}
            onChange={(event) => set("initialDisturbance", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Current SUD
          <input
            type="number"
            min="0"
            max="10"
            value={draft.currentDisturbance ?? ""}
            onChange={(event) => set("currentDisturbance", optionalNumber(event.target.value))}
          />
        </label>
      </div>
      <label>
        Status
        <select value={draft.status} onChange={(event) => set("status", event.target.value as TargetStatus)}>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="deferred">Deferred</option>
        </select>
      </label>
      <label>
        Notes
        <textarea value={draft.notes ?? ""} onChange={(event) => set("notes", event.target.value)} />
      </label>
      <div className="buttonRow">
        <button type="submit">Save Version</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function HistoryPanel({
  sessions,
  targetById
}: {
  sessions: SessionAggregate[];
  targetById: Map<string, Target>;
}) {
  return (
    <>
      <h1>History</h1>
      {sessions.length === 0 && <p className="authNotice">No sessions yet.</p>}
      <div className="targetList">
        {sessions.map((session) => {
          const target = targetById.get(session.targetId);
          const startedAt = new Date(session.startedAt).toLocaleString();
          const endedAt = session.endedAt ? new Date(session.endedAt).toLocaleString() : "ongoing";
          return (
            <article className="targetRow" key={session.id}>
              <div>
                <h2>{target?.description ?? "Unknown target"}</h2>
                <p>
                  Started {startedAt} · {endedAt}
                </p>
                <p>
                  {session.stimulationSets.length} set
                  {session.stimulationSets.length === 1 ? "" : "s"}
                  {session.assessment.disturbance !== undefined
                    ? ` · SUD start ${session.assessment.disturbance}`
                    : ""}
                  {session.finalDisturbance !== undefined ? ` · SUD end ${session.finalDisturbance}` : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function SettingsPanel({
  settings,
  onChange,
  onExport,
  onImport
}: {
  settings: BilateralStimulationSettings;
  onChange: (patch: Partial<BilateralStimulationSettings>) => void;
  onExport: () => Promise<string | undefined>;
  onImport: () => Promise<boolean>;
}) {
  return (
    <>
      <h1>Ball Settings</h1>
      <label>
        Ball speed
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.1"
          value={settings.speed}
          onChange={(event) => onChange({ speed: Number(event.target.value) })}
        />
      </label>
      <div className="speedReadout">{settings.speed.toFixed(1)}x</div>
      <label>
        Dot color
        <select
          value={settings.dotColor}
          onChange={(event) => onChange({ dotColor: event.target.value as BilateralStimulationSettings["dotColor"] })}
        >
          <option value="green">Green</option>
          <option value="blue">Blue</option>
          <option value="white">White</option>
          <option value="orange">Orange</option>
        </select>
      </label>
      <label>
        Dot size
        <select
          value={settings.dotSize}
          onChange={(event) => onChange({ dotSize: event.target.value as BilateralStimulationSettings["dotSize"] })}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
      <h2>Encrypted Data</h2>
      <div className="buttonRow">
        <button onClick={() => void onExport()}>Export</button>
        <button onClick={() => void onImport()}>Import</button>
      </div>
    </>
  );
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
