import { useEffect, useReducer, useState, type FormEvent } from "react";
import { RoomScene, type RoomObjectId } from "../../../src/animation/RoomScene";
import type { GuideAction, GuideAnimationIntent } from "../../../src/animation/guideAnimationModel";
import {
  createVault,
  exportVault,
  getVaultStatus,
  importVault,
  loadDatabase,
  saveDatabase,
  unlockWithPassword,
  unlockWithRecoveryCode,
  type VaultStatus
} from "../../../src/db";
import { nowIso, optionalNumber } from "../../../utils";
import { createSessionForTarget } from "../../session/factory";
import type { SessionAggregate } from "../../session/types";
import { updateBilateralStimulationSettings } from "../../setting/service";
import type { BilateralStimulationSettings } from "../../setting/types";
import { createStimulationSet } from "../../stimulation-set/factory";
import type { Target, TargetStatus } from "../../target/entity";
import { createTarget } from "../../target/factory";
import { currentTargets, reviseTarget } from "../../target/service";
import { createEmptyDatabase } from "../factory";
import type { Database } from "../types";
import {
  animatedPanelForState,
  animatedRoomStimulationRunning,
  initialAnimatedRoomState,
  transitionAnimatedRoomState
} from "../animatedRoomMachine";
import { RecoveryCode, VaultSetup, VaultUnlock } from "./VaultAccess";

type AuthState = "checking" | "setup" | "recovery" | "locked" | "ready";

const dotColorHex: Record<BilateralStimulationSettings["dotColor"], string> = {
  green: "#6dd07a",
  blue: "#6ec1e4",
  white: "#f3f3f3",
  orange: "#ff9b50"
};

export function AnimatedApp() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [database, setDatabase] = useState<Database>(() => createEmptyDatabase());
  const [roomState, dispatchRoomEvent] = useReducer(transitionAnimatedRoomState, initialAnimatedRoomState);
  const [guideAnimation, setGuideAnimation] = useState<GuideAnimationIntent>({ type: "action", action: "speak" });
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [activeSession, setActiveSession] = useState<SessionAggregate | null>(null);
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

  useEffect(() => {
    if (authState === "ready") {
      void saveDatabase(database);
    }
  }, [database, authState]);

  async function loadUnlockedDatabase() {
    setDatabase(await loadDatabase());
    setAuthState("ready");
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
    setEditingTarget(null);
    setAuthState("locked");
    return true;
  }

  function addTarget() {
    const target = createTarget({
      description: "New target",
      negativeCognition: "",
      positiveCognition: "",
      status: "active"
    });
    setDatabase((current) => ({ ...current, targets: current.targets.concat(target) }));
    setEditingTarget(target);
  }

  function saveTarget(target: Target) {
    if (!editingTarget) return;
    setDatabase((current) => reviseTarget(current, editingTarget, target));
    setEditingTarget(null);
  }

  function startSession(target: Target) {
    const session = createSessionForTarget(target);
    setDatabase((current) => ({ ...current, sessions: current.sessions.concat(session) }));
    setActiveSession(session);
    setEditingTarget(null);
    dispatchRoomEvent({ type: "select_guide" });
    setGuideAnimation({ type: "action", action: "speak" });
    setChatMessages([`Started session for "${target.description}".`]);
  }

  function endActiveSession() {
    if (!activeSession) return;
    const ended = { ...activeSession, endedAt: nowIso() };
    setDatabase((current) => ({
      ...current,
      sessions: current.sessions.map((session) => (session.id === ended.id ? ended : session))
    }));
    setActiveSession(null);
    if (stimulationRunning) {
      dispatchRoomEvent({ type: "pause_stimulation" });
    }
  }

  function updateSettings(patch: Partial<BilateralStimulationSettings>) {
    setDatabase((current) => updateBilateralStimulationSettings(current, patch));
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

  function toggleStimulation() {
    if (stimulationRunning) {
      logStimulationSetIfActive();
      dispatchRoomEvent({ type: "pause_stimulation" });
    } else {
      dispatchRoomEvent({ type: "start_stimulation" });
    }
  }

  function logStimulationSetIfActive() {
    if (!activeSession) return;
    const set = createStimulationSet({
      sessionId: activeSession.id,
      setNumber: activeSession.stimulationSets.length + 1,
      cycleCount: 24,
      observation: ""
    });
    const nextSession = { ...activeSession, stimulationSets: activeSession.stimulationSets.concat(set) };
    setActiveSession(nextSession);
    setDatabase((current) => ({
      ...current,
      sessions: current.sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
    }));
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
  const panelClass = panel ? `animatedPanel animatedPanel-${panel}` : "animatedPanel";
  const settings = database.settings.bilateralStimulation;
  const targets = currentTargets(database);
  const sessionsByTargetId = new Map(targets.map((target) => [target.id, target] as const));
  const sessionHistory = [...database.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

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
          <button onClick={toggleStimulation} disabled={!activeSession && !stimulationRunning}>
            {stimulationRunning ? "Pause" : "Start"} Set
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
                  chatMessages={chatMessages}
                  chatDraft={chatDraft}
                  onChatChange={setChatDraft}
                  onSubmitChat={submitChat}
                  onEndSession={endActiveSession}
                />
              ) : (
                <IdleGuideChat
                  targetCount={targets.length}
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
              targetById={new Map(database.targets.map((target) => [target.id, target]))}
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

function IdleGuideChat({ targetCount, onOpenTargets }: { targetCount: number; onOpenTargets: () => void }) {
  return (
    <div className="chatLog">
      <p className="guideBubble">
        {targetCount === 0
          ? "We have no targets yet. Open Targets to add the first one."
          : `You have ${targetCount} active target${targetCount === 1 ? "" : "s"}. Pick one to start a session.`}
      </p>
      <button onClick={onOpenTargets}>Open Targets</button>
    </div>
  );
}

function ActiveSessionChat({
  session,
  targetDescription,
  chatMessages,
  chatDraft,
  onChatChange,
  onSubmitChat,
  onEndSession
}: {
  session: SessionAggregate;
  targetDescription?: string;
  chatMessages: string[];
  chatDraft: string;
  onChatChange: (value: string) => void;
  onSubmitChat: (event: FormEvent) => void;
  onEndSession: () => void;
}) {
  return (
    <>
      <p className="authNotice">
        {targetDescription ?? "Unknown target"} · {session.stimulationSets.length} set
        {session.stimulationSets.length === 1 ? "" : "s"} logged
      </p>
      <div className="chatLog">
        {chatMessages.map((message, index) => (
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
      <div className="buttonRow">
        <button onClick={onEndSession}>End session</button>
      </div>
    </>
  );
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

function authStateForVault(status: VaultStatus): AuthState {
  if (status === "setupRequired") return "setup";
  if (status === "locked") return "locked";
  return "ready";
}
