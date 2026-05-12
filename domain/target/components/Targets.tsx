import { useEffect, useState } from "react";
import type { Database } from "../../../src/main/internal/domain/app/types";
import { optionalNumber } from "../../../utils";
import type { Target, TargetStatus } from "../entity";
import { createTarget } from "../factory";
import { currentTargets, reviseTarget } from "../service";

export function Targets({ database, onChange }: { database: Database; onChange: (database: Database) => void }) {
  const [editing, setEditing] = useState<Target | null>(null);
  const targets = currentTargets(database);

  function addTarget() {
    const target = createTarget({
      description: "New target",
      negativeCognition: "",
      positiveCognition: "",
      status: "active"
    });

    onChange({
      ...database,
      targets: database.targets.concat(target)
    });
    setEditing(target);
  }

  function saveTarget(target: Target) {
    if (!editing) return;
    onChange(reviseTarget(database, editing, target));
    setEditing(null);
  }

  return (
    <main className="screen split">
      <section className="panel">
        <div className="panelHeader">
          <h1>Targets</h1>
          <button onClick={addTarget}>New Target</button>
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
              <div className="sud">Disturbance {target.currentDisturbance ?? "-"}</div>
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

function TargetForm({ target, onSave }: { target: Target; onSave: (target: Target) => void }) {
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
          Initial disturbance
          <input
            type="number"
            min="0"
            max="10"
            value={draft.initialDisturbance ?? ""}
            onChange={(event) => set("initialDisturbance", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Current disturbance
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
      <button type="submit">Save Version</button>
    </form>
  );
}
