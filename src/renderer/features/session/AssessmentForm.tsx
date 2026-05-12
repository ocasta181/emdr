import { useEffect, useState } from "react";
import type { Assessment } from "../../../shared/types";
import { optionalNumber } from "../../../../utils";

export function AssessmentForm({
  assessment,
  onSave,
  onApprove
}: {
  assessment: Assessment;
  onSave: (assessment: Assessment) => void;
  onApprove: (assessment: Assessment) => void;
}) {
  const [draft, setDraft] = useState(assessment);

  useEffect(() => setDraft(assessment), [assessment]);

  function set<K extends keyof Assessment>(key: K, value: Assessment[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="form workflowForm"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label>
        Image
        <textarea value={draft.image ?? ""} onChange={(event) => set("image", event.target.value)} />
      </label>
      <label>
        Negative cognition
        <input
          value={draft.negativeCognition}
          onChange={(event) => set("negativeCognition", event.target.value)}
        />
      </label>
      <label>
        Positive cognition
        <input
          value={draft.positiveCognition}
          onChange={(event) => set("positiveCognition", event.target.value)}
        />
      </label>
      <div className="twoCol">
        <label>
          VOC
          <input
            type="number"
            min="1"
            max="7"
            value={draft.believability ?? ""}
            onChange={(event) => set("believability", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          SUD
          <input
            type="number"
            min="0"
            max="10"
            value={draft.disturbance ?? ""}
            onChange={(event) => set("disturbance", optionalNumber(event.target.value))}
          />
        </label>
      </div>
      <label>
        Emotions
        <input value={draft.emotions ?? ""} onChange={(event) => set("emotions", event.target.value)} />
      </label>
      <label>
        Body location
        <input value={draft.bodyLocation ?? ""} onChange={(event) => set("bodyLocation", event.target.value)} />
      </label>
      <div className="buttonRow">
        <button type="submit">Save assessment</button>
        <button type="button" onClick={() => onApprove(draft)}>
          Approve assessment
        </button>
      </div>
    </form>
  );
}
