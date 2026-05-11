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

const proctorLines = [
  "I can help you set up a target, run a set, or review prior notes.",
  "We will keep this structured. You can pause or stop at any point.",
  "When you are ready, describe the target in your own words. I will draft the record for review."
];

export function AnimatedApp() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [database, setDatabase] = useState<Database>(() => createEmptyDatabase());
  const [roomState, dispatchRoomEvent] = useReducer(transitionAnimatedRoomState, initialAnimatedRoomState);
  const [guideAnimation, setGuideAnimation] = useState<GuideAnimationIntent>({ type: "action", action: "speak" });
  const [lineIndex, setLineIndex] = useState(0);
  const [stimulationColor, setStimulationColor] = useState("#9cc7df");
  const [stimulationSpeed, setStimulationSpeed] = useState(1);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>(["I want to work with a target."]);

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
    setAuthState("locked");
    return true;
  }

  function selectObject(objectId: RoomObjectId) {
    if (objectId === "guide") {
      dispatchRoomEvent({ type: "select_guide" });
      setGuideAnimation({ type: "action", action: "speak" });
      setLineIndex((current) => (current + 1) % proctorLines.length);
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
    dispatchRoomEvent({ type: stimulationRunning ? "pause_stimulation" : "start_stimulation" });
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

  return (
    <div className={stimulationRunning ? "animatedApp stimulationActive" : "animatedApp"}>
      <RoomScene
        mode={stimulationRunning ? "stimulation" : panel === "chat" ? "chat" : "idle"}
        guideAnimation={guideAnimation}
        stimulationRunning={stimulationRunning}
        stimulationColor={stimulationColor}
        stimulationSpeed={stimulationSpeed}
        onObjectSelected={selectObject}
        onGuideActionComplete={handleGuideActionComplete}
      />

      <header className="animatedTopbar">
        <div>
          <div className="brand">EMDR Local</div>
          <div className="subtle">Animated room prototype</div>
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
          <button onClick={toggleStimulation}>
            {stimulationRunning ? "Pause" : "Start"} Set
          </button>
          {stimulationRunning && <button onClick={() => dispatchRoomEvent({ type: "select_settings" })}>Ball settings</button>}
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
              <div className="chatLog">
                <p className="guideBubble">{proctorLines[lineIndex]}</p>
                {chatMessages.map((message, index) => (
                  <p className="userBubble" key={`${message}-${index}`}>
                    {message}
                  </p>
                ))}
                <p className="guideBubble">
                  I will ask a few concise questions, then show you the draft before anything is saved.
                </p>
              </div>
              <form className="chatComposer" onSubmit={submitChat}>
                <label>
                  Reply
                  <textarea
                    placeholder="Type a test message for the future local agent..."
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                  />
                </label>
                <button type="submit">Send</button>
              </form>
            </>
          )}

          {panel === "targets" && (
            <>
              <h1>Targets</h1>
              <p className="authNotice">This panel will map to target selection and agent-drafted target review.</p>
              <div className="buttonRow">
                <button
                  className={isGuideAnimationAction(guideAnimation, "flip_through_book") ? "active" : undefined}
                  onClick={() => setGuideAnimation({ type: "action", action: "flip_through_book" })}
                >
                  Flip pages
                </button>
                <button
                  className={isGuideAnimationAction(guideAnimation, "write_in_book") ? "active" : undefined}
                  onClick={() => setGuideAnimation({ type: "action", action: "write_in_book" })}
                >
                  Write target
                </button>
              </div>
            </>
          )}

          {panel === "history" && (
            <>
              <h1>History</h1>
              <p className="authNotice">This panel will show approved session summaries, not raw transcripts by default.</p>
              <button>Open session archive</button>
            </>
          )}

          {panel === "settings" && (
            <>
              <h1>Ball Settings</h1>
              <label>
                Ball speed
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={stimulationSpeed}
                  onChange={(event) => setStimulationSpeed(Number(event.target.value))}
                />
              </label>
              <div className="speedReadout">{stimulationSpeed.toFixed(1)}x</div>
              <label>
                Stimulation color
                <input
                  type="color"
                  value={stimulationColor}
                  onChange={(event) => setStimulationColor(event.target.value)}
                />
              </label>
              <h2>Encrypted Data</h2>
              <div className="buttonRow">
                <button onClick={() => void exportEncryptedData()}>Export</button>
                <button onClick={() => void importEncryptedData()}>Import</button>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
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
