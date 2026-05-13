import { useEffect, useState } from "react";
import type { GuideAction } from "../../animation/guideAnimationModel";
import type { Target, TargetStatus } from "../../../shared/types";
import { optionalNumber } from "../../../../utils";

export function TargetsPanel({
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
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(target);
    setError("");
  }, [target]);

  function set<K extends keyof Target>(key: K, value: Target[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        const description = draft.description.trim();
        if (!description) {
          setError("Enter a target description.");
          return;
        }
        setError("");
        onSave({ ...draft, description });
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
      {error && <div className="formError">{error}</div>}
      <div className="buttonRow">
        <button type="submit">Save Version</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
