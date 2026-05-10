import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  activeTargets,
  createEmptyDatabase,
  createEvent,
  createId,
  headTargets,
  loadDatabase,
  nowIso,
  saveDatabase,
  upsertSession,
  versionTarget
} from "./db";
import type { Assessment, Database, Session, StimulationSet, TargetStatus, TargetVersion } from "./types";

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
  const [session, setSession] = useState<Session | null>(null);

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

  function startSession(target: TargetVersion) {
    const nextSession: Session = {
      id: createId("session"),
      targetRootId: target.rootTargetId,
      targetVersionId: target.id,
      startedAt: nowIso(),
      assessment: {
        negativeCognition: target.negativeCognition,
        positiveCognition: target.positiveCognition,
        subjectiveUnitsOfDisturbance: target.currentSud
      },
      stimulationSets: []
    };

    setDatabase(upsertSession(database, nextSession, "session.started"));
    setSession(nextSession);
    setView("session");
  }

  function persistSession(nextSession: Session, eventType: string) {
    setSession(nextSession);
    setDatabase(upsertSession(database, nextSession, eventType));
  }

  function endSession(nextSession: Session) {
    const ended = {
      ...nextSession,
      endedAt: nowIso()
    };
    const target = database.targets.find((item) => item.id === ended.targetVersionId);
    let nextDatabase = upsertSession(database, ended, "session.ended");

    if (target && typeof ended.finalSud === "number") {
      nextDatabase = versionTarget(nextDatabase, target, { currentSud: ended.finalSud });
    }

    setSession(null);
    setDatabase(nextDatabase);
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

function Dashboard({ database, onStartSession }: { database: Database; onStartSession: (target: TargetVersion) => void }) {
  const targets = headTargets(database);
  const active = targets.filter((target) => target.status === "active");
  const completed = targets.filter((target) => target.status === "completed");
  const endedSessions = database.sessions.filter((item) => item.endedAt);

  return (
    <main className="screen">
      <section className="metrics">
        <Metric label="Sessions" value={endedSessions.length.toString()} />
        <Metric label="Active targets" value={active.length.toString()} />
        <Metric label="Completed targets" value={completed.length.toString()} />
        <Metric label="Local events" value={database.activityEvents.length.toString()} />
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h1>Active Targets</h1>
        </div>
        <div className="targetList">
          {active.length === 0 && <div className="empty">No active targets yet.</div>}
          {active.map((target) => (
            <article className="targetRow" key={target.id}>
              <div>
                <h2>{target.description}</h2>
                <p>{target.clusterTag || "No cluster"}</p>
              </div>
              <div className="sud">Disturbance {target.currentSud ?? "-"}</div>
              <button onClick={() => onStartSession(target)}>Start Session</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h1>Recent Sessions</h1>
        </div>
        <div className="history">
          {database.sessions
            .slice()
            .reverse()
            .slice(0, 8)
            .map((session) => {
              const target = database.targets.find((item) => item.id === session.targetVersionId);
              return (
                <div className="historyRow" key={session.id}>
                  <span>{new Date(session.startedAt).toLocaleString()}</span>
                  <span>{target?.description ?? "Unknown target"}</span>
                  <span>Final disturbance {session.finalSud ?? "-"}</span>
                </div>
              );
            })}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Targets({ database, onChange }: { database: Database; onChange: (database: Database) => void }) {
  const [editing, setEditing] = useState<TargetVersion | null>(null);
  const targets = headTargets(database);

  function createTarget() {
    const now = nowIso();
    const rootTargetId = createId("target_root");
    const target: TargetVersion = {
      id: createId("target"),
      rootTargetId,
      isHead: true,
      createdAt: now,
      updatedAt: now,
      description: "New target",
      negativeCognition: "",
      positiveCognition: "",
      status: "active"
    };

    onChange({
      ...database,
      targets: database.targets.concat(target),
      activityEvents: database.activityEvents.concat(createEvent("target.created", "target", rootTargetId))
    });
    setEditing(target);
  }

  function saveTarget(target: TargetVersion) {
    if (!editing) return;
    onChange(versionTarget(database, editing, target));
    setEditing(null);
  }

  return (
    <main className="screen split">
      <section className="panel">
        <div className="panelHeader">
          <h1>Targets</h1>
          <button onClick={createTarget}>New Target</button>
        </div>
        <div className="targetList">
          {targets.map((target) => (
            <article className="targetRow" key={target.id}>
              <div>
                <h2>{target.description}</h2>
                <p>
                  {target.status} · {target.clusterTag || "No cluster"}
                </p>
              </div>
              <div className="sud">Disturbance {target.currentSud ?? "-"}</div>
              <button onClick={() => setEditing(target)}>Edit</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h1>{editing ? "Edit Target" : "Target Details"}</h1>
        </div>
        {editing ? <TargetForm target={editing} onSave={saveTarget} /> : <div className="empty">Select a target.</div>}
      </section>
    </main>
  );
}

function TargetForm({ target, onSave }: { target: TargetVersion; onSave: (target: TargetVersion) => void }) {
  const [draft, setDraft] = useState(target);

  useEffect(() => setDraft(target), [target]);

  function set<K extends keyof TargetVersion>(key: K, value: TargetVersion[K]) {
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
          Initial disturbance
          <input
            type="number"
            min="0"
            max="10"
            value={draft.initialSud ?? ""}
            onChange={(event) => set("initialSud", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Current disturbance
          <input
            type="number"
            min="0"
            max="10"
            value={draft.currentSud ?? ""}
            onChange={(event) => set("currentSud", optionalNumber(event.target.value))}
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
      <button type="submit">Save Version</button>
    </form>
  );
}

function SessionFlow({
  database,
  session,
  onPersist,
  onEnd
}: {
  database: Database;
  session: Session;
  onPersist: (session: Session, eventType: string) => void;
  onEnd: (session: Session) => void;
}) {
  const [step, setStep] = useState<"assessment" | "stimulation" | "close" | "summary">("assessment");
  const target = database.targets.find((item) => item.id === session.targetVersionId);

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
            onChange={(assessment) => onPersist({ ...session, assessment }, "session.assessment.updated")}
            onNext={() => setStep("stimulation")}
          />
        )}
        {step === "stimulation" && (
          <StimulationStep
            database={database}
            session={session}
            onChange={(nextSession) => onPersist(nextSession, "session.stimulation.updated")}
            onNext={() => setStep("close")}
          />
        )}
        {step === "close" && (
          <CloseStep
            session={session}
            onChange={(nextSession) => onPersist(nextSession, "session.closure.updated")}
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
            value={assessment.validityOfCognition ?? ""}
            onChange={(event) => set("validityOfCognition", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Disturbance
          <input
            type="number"
            min="0"
            max="10"
            value={assessment.subjectiveUnitsOfDisturbance ?? ""}
            onChange={(event) => set("subjectiveUnitsOfDisturbance", optionalNumber(event.target.value))}
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
  session: Session;
  onChange: (session: Session) => void;
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
      subjectiveUnitsOfDisturbance: optionalNumber(sud)
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
              <span>Disturbance {set.subjectiveUnitsOfDisturbance ?? "-"}</span>
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
  session: Session;
  onChange: (session: Session) => void;
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
          value={session.finalSud ?? ""}
          onChange={(event) => onChange({ ...session, finalSud: optionalNumber(event.target.value) })}
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

function SummaryStep({ session, onEnd }: { session: Session; onEnd: () => void }) {
  return (
    <div className="summary">
      <h2>Session Summary</h2>
      <dl>
        <dt>Started</dt>
        <dd>{new Date(session.startedAt).toLocaleString()}</dd>
        <dt>Sets</dt>
        <dd>{session.stimulationSets.length}</dd>
        <dt>Final disturbance</dt>
        <dd>{session.finalSud ?? "-"}</dd>
      </dl>
      <button onClick={onEnd}>End Session</button>
    </div>
  );
}

function optionalNumber(value: string) {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

createRoot(document.getElementById("root")!).render(<App />);
