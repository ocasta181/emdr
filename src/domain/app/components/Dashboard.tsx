import { currentTargets } from "../../target/service";
import type { Database, Target } from "../../../types";

export function Dashboard({
  database,
  onStartSession
}: {
  database: Database;
  onStartSession: (target: Target) => void;
}) {
  const targets = currentTargets(database);
  const active = targets.filter((target) => target.status === "active");
  const completed = targets.filter((target) => target.status === "completed");
  const endedSessions = database.sessions.filter((item) => item.endedAt);

  return (
    <main className="screen">
      <section className="metrics">
        <Metric label="Sessions" value={endedSessions.length.toString()} />
        <Metric label="Active targets" value={active.length.toString()} />
        <Metric label="Completed targets" value={completed.length.toString()} />
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
              <div className="sud">Disturbance {target.currentDisturbance ?? "-"}</div>
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
              const target = database.targets.find((item) => item.id === session.targetId);
              return (
                <div className="historyRow" key={session.id}>
                  <span>{new Date(session.startedAt).toLocaleString()}</span>
                  <span>{target?.description ?? "Unknown target"}</span>
                  <span>Final disturbance {session.finalDisturbance ?? "-"}</span>
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
