import type { SessionWorkflowSnapshot } from "../../../shared/types";

export function WorkflowControls({
  workflow,
  onStartSet,
  onRequestGrounding,
  onBeginClosure,
  onRequestReview
}: {
  workflow: SessionWorkflowSnapshot["state"];
  onStartSet: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
}) {
  return (
    <div className="workflowControls">
      {(workflow === "preparation" || workflow === "stimulation") && (
        <button className={workflow === "stimulation" ? "primary" : undefined} onClick={onStartSet}>
          Start set
        </button>
      )}
      {(workflow === "interjection" || workflow === "closure") && (
        <button className={workflow === "interjection" ? "primary" : undefined} onClick={onStartSet}>
          Continue set
        </button>
      )}
      {(workflow === "stimulation" || workflow === "closure") && (
        <button onClick={onRequestGrounding}>Grounding</button>
      )}
      {(workflow === "stimulation" || workflow === "interjection") && (
        <button onClick={onBeginClosure}>Begin closure</button>
      )}
      {workflow === "closure" && (
        <button className="primary" onClick={onRequestReview}>
          Request review
        </button>
      )}
    </div>
  );
}
