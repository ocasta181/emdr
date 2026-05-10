import { useState, type FormEvent } from "react";
import { RoomScene, type GuideState, type RoomObjectId } from "../../../src/animation/RoomScene";
import { deriveSceneViewModel, type SceneContext } from "../../../src/animation/guideSceneModel";

type AnimatedPanel = "chat" | "targets" | "history" | "settings" | null;

const proctorLines = [
  "I can help you set up a target, run a set, or review prior notes.",
  "We will keep this structured. You can pause or stop at any point.",
  "When you are ready, describe the target in your own words. I will draft the record for review."
];

export function AnimatedApp() {
  const [panel, setPanel] = useState<AnimatedPanel>("chat");
  const [lineIndex, setLineIndex] = useState(0);
  const [stimulationRunning, setStimulationRunning] = useState(false);
  const [stimulationColor, setStimulationColor] = useState("#9cc7df");
  const [stimulationSpeed, setStimulationSpeed] = useState(1);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>(["I want to work with a target."]);
  const [targetMode, setTargetMode] = useState<SceneContext["targetMode"]>("closed");

  function selectObject(objectId: RoomObjectId) {
    if (objectId === "guide") {
      setTargetMode("closed");
      setPanel("chat");
      setLineIndex((current) => (current + 1) % proctorLines.length);
      return;
    }
    if (objectId === "targets") {
      setTargetMode("reading");
      setPanel("targets");
      return;
    }
    if (objectId === "settings" && !stimulationRunning) {
      return;
    }
    setTargetMode("closed");
    setPanel(objectId);
  }

  function toggleStimulation() {
    setStimulationRunning((current) => {
      const next = !current;
      if (next) setTargetMode("closed");
      setPanel(next ? null : "chat");
      return next;
    });
  }

  function closePanel() {
    if (panel === "targets") {
      setTargetMode("closed");
    }
    setPanel(null);
  }

  function submitChat(event: FormEvent) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message) return;
    setChatMessages((current) => current.concat(message));
    setChatDraft("");
  }

  const panelClass = panel ? `animatedPanel animatedPanel-${panel}` : "animatedPanel";
  const guideState: GuideState = stimulationRunning
    ? "listening"
    : panel === "settings"
      ? "thinking"
      : chatDraft.trim()
        ? "listening"
        : panel === "chat"
          ? "speaking"
          : panel
            ? "thinking"
            : "idle";
  const sceneViewModel = deriveSceneViewModel({
    targetMode,
    stimulationRunning,
    panel,
    guideSpeaking: panel === "chat",
    userTyping: Boolean(chatDraft.trim())
  });

  return (
    <div className={stimulationRunning ? "animatedApp stimulationActive" : "animatedApp"}>
      <RoomScene
        mode={stimulationRunning ? "stimulation" : panel === "chat" ? "chat" : "idle"}
        guideState={guideState}
        sceneViewModel={sceneViewModel}
        stimulationRunning={stimulationRunning}
        stimulationColor={stimulationColor}
        stimulationSpeed={stimulationSpeed}
        onObjectSelected={selectObject}
      />

      <header className="animatedTopbar">
        <div>
          <div className="brand">EMDR Local</div>
          <div className="subtle">Animated room prototype</div>
        </div>
        <div className="buttonRow">
          <button
            onClick={() => {
              setTargetMode("closed");
              setPanel("chat");
            }}
          >
            Guide
          </button>
          <button onClick={toggleStimulation}>
            {stimulationRunning ? "Pause" : "Start"} Set
          </button>
          {stimulationRunning && <button onClick={() => setPanel("settings")}>Ball settings</button>}
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
                <button onClick={() => setTargetMode("browsing")}>Flip pages</button>
                <button onClick={() => setTargetMode("writing")}>Write target</button>
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
            </>
          )}
        </aside>
      )}
    </div>
  );
}
