import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Dashboard } from "./domain/app/components/Dashboard";
import { createEmptyDatabase } from "./domain/app/factory";
import {
  endSession as completeSession,
  saveSessionDraft,
  startSessionForTarget
} from "./domain/app/service";
import { Targets } from "./domain/target/components/Targets";
import { loadDatabase, saveDatabase } from "./db";
import { optionalNumber } from "./support/form";
import { createId, nowIso } from "./support/ids";
import type { Assessment, Database, SessionAggregate, StimulationSet, Target } from "./types";

const colors = {
  green: "#8fbf8f",
  blue: "#8fb4d8",
  white: "#f2efe8",
  orange: "#d89b64"
};

function App() {
  const [database, setDatabase] = useState<Database>(() => createEmptyDatabase());
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"dashboard" | "targets" | "session">("dashboard");
  const [session, setSession] = useState<SessionAggregate | null>(null);

  useEffect(() => {
    loadDatabase().then((loadedDatabase) => {
      setDatabase(loadedDatabase);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      void saveDatabase(database);
    }
  }, [database, loaded]);

  function updateDatabase(next: Database) {
    setDatabase(next);
  }

  function startSession(target: Target) {
    const next = startSessionForTarget(database, target);
    setDatabase(next.database);
    setSession(next.session);
    setView("session");
  }

  function persistSession(nextSession: SessionAggregate) {
    setSession(nextSession);
    setDatabase(saveSessionDraft(database, nextSession));
  }

  function endSession(nextSession: SessionAggregate) {
    setSession(null);
    setDatabase(completeSession(database, nextSession));
    setView("dashboard");
  }

  if (!loaded) {
    return <div className="boot">Loading local data...</div>;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">EMDR Local</div>
          <div className="subtle">Local-only session tracking and visual bilateral stimulation</div>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={view === "targets" ? "active" : ""} onClick={() => setView("targets")}>
            Targets
          </button>
        </nav>
      </header>

      {view === "dashboard" && <Dashboard database={database} onStartSession={startSession} />}
      {view === "targets" && <Targets database={database} onChange={updateDatabase} />}
      {view === "session" && session && (
        <SessionFlow database={database} session={session} onPersist={persistSession} onEnd={endSession} />
      )}
    </div>
  );
}

function SessionFlow({
  database,
  session,
  onPersist,
  onEnd
}: {
  database: Database;
  session: SessionAggregate;
  onPersist: (session: SessionAggregate) => void;
  onEnd: (session: SessionAggregate) => void;
}) {
  const [step, setStep] = useState<"assessment" | "stimulation" | "close" | "summary">("assessment");
  const target = database.targets.find((item) => item.id === session.targetId);

  return (
    <main className="screen">
      <section className="panel sessionPanel">
        <div className="panelHeader">
          <div>
            <h1>Session</h1>
            <p>{target?.description}</p>
          </div>
          <div className="steps">
            {["assessment", "stimulation", "close", "summary"].map((item) => (
              <button key={item} className={step === item ? "active" : ""} onClick={() => setStep(item as typeof step)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        {step === "assessment" && (
          <AssessmentStep
            assessment={session.assessment}
            onChange={(assessment) => onPersist({ ...session, assessment })}
            onNext={() => setStep("stimulation")}
          />
        )}
        {step === "stimulation" && (
          <StimulationStep
            database={database}
            session={session}
            onChange={(nextSession) => onPersist(nextSession)}
            onNext={() => setStep("close")}
          />
        )}
        {step === "close" && (
          <CloseStep
            session={session}
            onChange={(nextSession) => onPersist(nextSession)}
            onEnd={() => setStep("summary")}
          />
        )}
        {step === "summary" && <SummaryStep session={session} onEnd={() => onEnd(session)} />}
      </section>
    </main>
  );
}

function AssessmentStep({
  assessment,
  onChange,
  onNext
}: {
  assessment: Assessment;
  onChange: (assessment: Assessment) => void;
  onNext: () => void;
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
      <button onClick={onNext}>Continue</button>
    </div>
  );
}

function StimulationStep({
  database,
  session,
  onChange,
  onNext
}: {
  database: Database;
  session: SessionAggregate;
  onChange: (session: SessionAggregate) => void;
  onNext: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [observation, setObservation] = useState("");
  const [sud, setSud] = useState("");
  const settings = database.settings.bilateralStimulation;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
    const nextSet: StimulationSet = {
      id: createId("set"),
      sessionId: session.id,
      setNumber: session.stimulationSets.length + 1,
      createdAt: nowIso(),
      cycleCount: cycles,
      observation,
      disturbance: optionalNumber(sud)
    };

    onChange({
      ...session,
      stimulationSets: session.stimulationSets.concat(nextSet)
    });
    setObservation("");
    setSud("");
    setCycles(0);
    textareaRef.current?.focus();
  }

  return (
    <div className="stimulationGrid">
      <section className={`stimulus ${running ? "running" : ""}`}>
        <div
          className={`dot ${settings.dotSize}`}
          style={{
            backgroundColor: colors[settings.dotColor],
            animationDuration: `${2 / settings.speed}s`,
            animationPlayState: running ? "running" : "paused"
          }}
        />
        <div className="counter">{cycles} cycles</div>
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
          <input type="number" min="0" max="10" value={sud} onChange={(event) => setSud(event.target.value)} />
        </label>
        <div className="buttonRow">
          <button onClick={logSet} disabled={!observation.trim()}>
            Log Set
          </button>
          <button onClick={onNext}>Close Session</button>
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

function CloseStep({
  session,
  onChange,
  onEnd
}: {
  session: SessionAggregate;
  onChange: (session: SessionAggregate) => void;
  onEnd: () => void;
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
      <button onClick={onEnd}>Review Summary</button>
    </div>
  );
}

function SummaryStep({ session, onEnd }: { session: SessionAggregate; onEnd: () => void }) {
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
      <button onClick={onEnd}>End Session</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
