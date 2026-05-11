import { useEffect, useRef, useState } from "react";
import type { Database } from "../../app/types";
import { BilateralStimulationSettings, ballColors } from "../../setting/components/BilateralStimulationSettings";
import { updateBilateralStimulationSettings } from "../../setting/service";
import { createStimulationSet } from "../../stimulation-set/factory";
import { optionalNumber } from "../../../utils";
import type { StimulationSet } from "../../stimulation-set/entity";
import type { Assessment, SessionAggregate, SessionFlowAction, SessionFlowState } from "../types";
import { getSessionFlowStateDetails, nextSessionFlowState, sessionFlowStateLabels } from "../service";

export function SessionFlow({
  database,
  session,
  onDatabaseChange,
  onPersist,
  onEnd
}: {
  database: Database;
  session: SessionAggregate;
  onDatabaseChange: (database: Database) => void;
  onPersist: (session: SessionAggregate) => void;
  onEnd: (session: SessionAggregate) => void;
}) {
  const [flowState, setFlowState] = useState<SessionFlowState>("preparation");
  const target = database.targets.find((item) => item.id === session.targetId);
  const stateDetails = getSessionFlowStateDetails(flowState);

  function applyAction(action: SessionFlowAction) {
    setFlowState((current) => nextSessionFlowState(current, action));
  }

  function completeSession() {
    nextSessionFlowState(flowState, "complete_session");
    onEnd(session);
  }

  return (
    <main className="screen">
      <section className="panel sessionPanel">
        <div className="panelHeader">
          <div>
            <h1>Session</h1>
            <p>{target?.description}</p>
            <p>{stateDetails.description}</p>
          </div>
          <div className="steps">
            {(["preparation", "stimulation", "interjection", "closure", "review"] satisfies SessionFlowState[]).map(
              (item) => (
                <button key={item} className={flowState === item ? "active" : ""} disabled>
                  {sessionFlowStateLabels[item]}
                </button>
              )
            )}
          </div>
        </div>

        {flowState === "preparation" && (
          <AssessmentStep
            assessment={session.assessment}
            onChange={(assessment) => onPersist({ ...session, assessment })}
            onNext={() => applyAction("approve_assessment")}
            onClose={() => applyAction("begin_closure")}
          />
        )}
        {flowState === "stimulation" && (
          <StimulationStep
            database={database}
            session={session}
            onDatabaseChange={onDatabaseChange}
            onChange={(nextSession) => onPersist(nextSession)}
            onLogSet={() => applyAction("log_stimulation_set")}
            onPause={() => applyAction("pause_stimulation")}
            onNext={() => applyAction("begin_closure")}
          />
        )}
        {flowState === "interjection" && (
          <InterjectionStep
            onContinue={() => applyAction("continue_stimulation")}
            onClose={() => applyAction("begin_closure")}
          />
        )}
        {flowState === "closure" && (
          <CloseStep
            session={session}
            onChange={(nextSession) => onPersist(nextSession)}
            onContinue={() => applyAction("continue_stimulation")}
            onReview={() => applyAction("review_session")}
          />
        )}
        {flowState === "review" && <SummaryStep session={session} onBack={() => applyAction("begin_closure")} onEnd={completeSession} />}
      </section>
    </main>
  );
}

function AssessmentStep({
  assessment,
  onChange,
  onNext,
  onClose
}: {
  assessment: Assessment;
  onChange: (assessment: Assessment) => void;
  onNext: () => void;
  onClose: () => void;
}) {
  function set<K extends keyof Assessment>(key: K, value: Assessment[K]) {
    onChange({ ...assessment, [key]: value });
  }

  return (
    <div className="form">
      <label>
        Image
        <textarea value={assessment.image ?? ""} onChange={(event) => set("image", event.target.value)} />
      </label>
      <div className="twoCol">
        <label>
          Negative cognition
          <input
            value={assessment.negativeCognition}
            onChange={(event) => set("negativeCognition", event.target.value)}
          />
        </label>
        <label>
          Positive cognition
          <input
            value={assessment.positiveCognition}
            onChange={(event) => set("positiveCognition", event.target.value)}
          />
        </label>
      </div>
      <div className="twoCol">
        <label>
          Believability
          <input
            type="number"
            min="1"
            max="7"
            value={assessment.believability ?? ""}
            onChange={(event) => set("believability", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Disturbance
          <input
            type="number"
            min="0"
            max="10"
            value={assessment.disturbance ?? ""}
            onChange={(event) => set("disturbance", optionalNumber(event.target.value))}
          />
        </label>
      </div>
      <label>
        Emotions
        <textarea value={assessment.emotions ?? ""} onChange={(event) => set("emotions", event.target.value)} />
      </label>
      <label>
        Body location
        <input value={assessment.bodyLocation ?? ""} onChange={(event) => set("bodyLocation", event.target.value)} />
      </label>
      <div className="buttonRow">
        <button onClick={onNext}>Start Stimulation</button>
        <button onClick={onClose}>Begin Closure</button>
      </div>
    </div>
  );
}
function StimulationStep({
  database,
  session,
  onDatabaseChange,
  onChange,
  onLogSet,
  onPause,
  onNext
}: {
  database: Database;
  session: SessionAggregate;
  onDatabaseChange: (database: Database) => void;
  onChange: (session: SessionAggregate) => void;
  onLogSet: () => void;
  onPause: () => void;
  onNext: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [observation, setObservation] = useState("");
  const [disturbance, setDisturbance] = useState("");
  const settings = database.settings.bilateralStimulation;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function changeSettings(nextSettings: typeof settings) {
    onDatabaseChange(updateBilateralStimulationSettings(database, nextSettings));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && event.target instanceof HTMLElement && event.target.tagName !== "TEXTAREA") {
        event.preventDefault();
        setRunning((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setCycles((current) => current + 1), Math.max(350, 1000 / settings.speed));
    return () => window.clearInterval(interval);
  }, [running, settings.speed]);

  useEffect(() => {
    if (!running) {
      textareaRef.current?.focus();
    }
  }, [running]);

  function logSet() {
    const nextSet: StimulationSet = createStimulationSet({
      sessionId: session.id,
      setNumber: session.stimulationSets.length + 1,
      cycleCount: cycles,
      observation,
      disturbance: optionalNumber(disturbance)
    });

    onChange({
      ...session,
      stimulationSets: session.stimulationSets.concat(nextSet)
    });
    onLogSet();
    setObservation("");
    setDisturbance("");
    setCycles(0);
    textareaRef.current?.focus();
  }

  return (
    <div className="stimulationGrid">
      <section className={`stimulus ${running ? "running" : ""}`}>
        <div
          className={`dot ${settings.dotSize}`}
          style={{
            color: ballColors[settings.dotColor],
            backgroundColor: ballColors[settings.dotColor],
            animationDuration: `${2 / settings.speed}s`,
            animationPlayState: running ? "running" : "paused"
          }}
        />
        <div className="counter">{cycles} cycles</div>
        <div className="stimulusSettings">
          <BilateralStimulationSettings settings={settings} onChange={changeSettings} compact />
        </div>
        <button className="stimulusButton" onClick={() => setRunning((current) => !current)}>
          {running ? "Stop" : "Start"} Visual Bilateral Stimulation
        </button>
      </section>
      <section className="setLogger">
        <label>
          What do you notice?
          <textarea ref={textareaRef} value={observation} onChange={(event) => setObservation(event.target.value)} />
        </label>
        <label>
          Disturbance
          <input
            type="number"
            min="0"
            max="10"
            value={disturbance}
            onChange={(event) => setDisturbance(event.target.value)}
          />
        </label>
        <div className="buttonRow">
          <button onClick={logSet} disabled={!observation.trim()}>
            Log Set
          </button>
          <button onClick={onPause}>Pause</button>
          <button onClick={onNext}>Begin Closure</button>
        </div>
        <div className="sets">
          {session.stimulationSets.map((set) => (
            <article key={set.id}>
              <strong>Set {set.setNumber}</strong>
              <span>Disturbance {set.disturbance ?? "-"}</span>
              <p>{set.observation}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function InterjectionStep({ onContinue, onClose }: { onContinue: () => void; onClose: () => void }) {
  return (
    <div className="form">
      <h2>Paused</h2>
      <p className="subtle">Continue stimulation when ready, or begin closure from here.</p>
      <div className="buttonRow">
        <button onClick={onContinue}>Continue Stimulation</button>
        <button onClick={onClose}>Begin Closure</button>
      </div>
    </div>
  );
}

function CloseStep({
  session,
  onChange,
  onContinue,
  onReview
}: {
  session: SessionAggregate;
  onChange: (session: SessionAggregate) => void;
  onContinue: () => void;
  onReview: () => void;
}) {
  return (
    <div className="form">
      <label>
        Final disturbance
        <input
          type="number"
          min="0"
          max="10"
          value={session.finalDisturbance ?? ""}
          onChange={(event) => onChange({ ...session, finalDisturbance: optionalNumber(event.target.value) })}
        />
      </label>
      <label>
        Session notes
        <textarea value={session.notes ?? ""} onChange={(event) => onChange({ ...session, notes: event.target.value })} />
      </label>
      <div className="buttonRow">
        <button onClick={onReview}>Review Summary</button>
        <button onClick={onContinue}>Continue Stimulation</button>
      </div>
    </div>
  );
}

function SummaryStep({
  session,
  onBack,
  onEnd
}: {
  session: SessionAggregate;
  onBack: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="summary">
      <h2>Session Summary</h2>
      <dl>
        <dt>Started</dt>
        <dd>{new Date(session.startedAt).toLocaleString()}</dd>
        <dt>Sets</dt>
        <dd>{session.stimulationSets.length}</dd>
        <dt>Final disturbance</dt>
        <dd>{session.finalDisturbance ?? "-"}</dd>
      </dl>
      <div className="buttonRow">
        <button onClick={onBack}>Back To Closure</button>
        <button onClick={onEnd}>End Session</button>
      </div>
    </div>
  );
}
