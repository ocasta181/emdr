import { useEffect, useState } from "react";
import type { GuideAction } from "../../animation/guideAnimationModel";
import type { Target, TargetDraft, TargetStatus } from "../../../shared/types";
import { ScaleInput, sudAnchors } from "../../components/ScaleInput";

export type TargetEditorState =
  | { kind: "new"; draft: TargetDraft }
  | { kind: "existing"; target: Target };

const statusOptions: Array<{ value: TargetStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "deferred", label: "Deferred" },
  { value: "completed", label: "Completed" }
];

export function TargetsPanel({
  targets,
  inactiveTargets,
  sudHistoryFor,
  editing,
  activeSessionTargetId,
  onAdd,
  onEdit,
  onCancelEdit,
  onSave,
  onAnimate
}: {
  targets: Target[];
  /** Current versions of completed or deferred targets, kept reachable so they can be reopened. */
  inactiveTargets: Target[];
  sudHistoryFor: (target: Target) => number[];
  editing: TargetEditorState | null;
  activeSessionTargetId: string | undefined;
  onAdd: () => void;
  onEdit: (target: Target) => void;
  onCancelEdit: () => void;
  onSave: (target: TargetEditorState) => void;
  onAnimate: (action: GuideAction) => void;
}) {
  if (editing) {
    return (
      <TargetForm
        editing={editing}
        onSave={(target) => {
          onAnimate("write_in_book");
          onSave(target);
        }}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <div className="targetList">
      {targets.length === 0 && <p className="authNotice">No active targets yet.</p>}
      {targets.map((target) => (
        <article className="targetRow" key={target.id}>
          <div className="targetText">
            <h2>{target.description}</h2>
            <p>
              {[
                target.clusterTag,
                (target.currentDisturbance ?? target.initialDisturbance) !== undefined
                  ? `SUD ${target.currentDisturbance ?? target.initialDisturbance}`
                  : undefined
              ]
                .filter(Boolean)
                .join(" · ") || "No SUD yet"}
              {activeSessionTargetId === target.id && <span className="inlineStatus">In session</span>}
            </p>
          </div>
          <SudTrend points={sudHistoryFor(target)} />
          <div className="rowActions">
            <button
              className="quiet"
              onClick={() => {
                onAnimate("flip_through_book");
                onEdit(target);
              }}
            >
              Edit
            </button>
          </div>
        </article>
      ))}
      <button className="primary" onClick={onAdd}>
        New target
      </button>
      {inactiveTargets.length > 0 && (
        <details className="inactiveTargets">
          <summary>Completed and deferred ({inactiveTargets.length})</summary>
          {inactiveTargets.map((target) => (
            <article className="targetRow" key={target.id}>
              <div className="targetText">
                <h2>{target.description}</h2>
                <p>{target.status === "completed" ? "Completed" : "Deferred"}</p>
              </div>
              <div className="rowActions">
                <button
                  className="quiet"
                  onClick={() => {
                    onAnimate("flip_through_book");
                    onEdit(target);
                  }}
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
        </details>
      )}
    </div>
  );
}

function TargetForm({
  editing,
  onSave,
  onCancel
}: {
  editing: TargetEditorState;
  onSave: (target: TargetEditorState) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TargetDraft>(editableTargetDraft(editing));
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(editableTargetDraft(editing));
    setError("");
  }, [editing]);

  function set<K extends keyof TargetDraft>(key: K, value: TargetDraft[K]) {
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
        if (editing.kind === "new") {
          onSave({ kind: "new", draft: { ...draft, description, status: draft.status ?? "active" } });
          return;
        }
        onSave({
          kind: "existing",
          target: { ...editing.target, ...draft, description, status: draft.status ?? editing.target.status }
        });
      }}
    >
      <h2>{editing.kind === "new" ? "New target" : "Edit target"}</h2>
      <label>
        Description
        <textarea autoFocus value={draft.description} onChange={(event) => set("description", event.target.value)} />
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
      <ScaleInput
        label="Initial SUD" anchors={sudAnchors}
        min={0}
        max={10}
        value={draft.initialDisturbance}
        onChange={(value) => set("initialDisturbance", value)}
      />
      <ScaleInput
        label="Current SUD" anchors={sudAnchors}
        min={0}
        max={10}
        value={draft.currentDisturbance}
        onChange={(value) => set("currentDisturbance", value)}
      />
      <div className="fieldGroup">
        <span className="scaleLabel" id="target-status-label">
          Status
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="target-status-label">
          {statusOptions.map((option) => {
            const selected = (draft.status ?? "active") === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "selected" : undefined}
                onClick={() => set("status", option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <label>
        Notes
        <textarea value={draft.notes ?? ""} onChange={(event) => set("notes", event.target.value)} />
      </label>
      {error && <div className="formError">{error}</div>}
      <div className="buttonRow">
        <button type="submit" className="primary">
          {editing.kind === "new" ? "Save target" : "Save new version"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function editableTargetDraft(editing: TargetEditorState): TargetDraft {
  if (editing.kind === "new") {
    return editing.draft;
  }
  return {
    description: editing.target.description,
    negativeCognition: editing.target.negativeCognition,
    positiveCognition: editing.target.positiveCognition,
    clusterTag: editing.target.clusterTag,
    initialDisturbance: editing.target.initialDisturbance,
    currentDisturbance: editing.target.currentDisturbance,
    status: editing.target.status,
    notes: editing.target.notes
  };
}

/** A tiny SUD line, 0 at the bottom and 10 at the top, shown once there are two readings. */
function SudTrend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const width = 64;
  const height = 22;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => `${(index * step).toFixed(1)},${(height - 2 - (value / 10) * (height - 4)).toFixed(1)}`);
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <svg
      className="sudTrend"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`SUD over sessions: ${points.join(", ")}`}
    >
      <title>{`SUD ${first} → ${last}`}</title>
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].split(",")[0]} cy={coords[coords.length - 1].split(",")[1]} r="2.4" fill="currentColor" />
    </svg>
  );
}
