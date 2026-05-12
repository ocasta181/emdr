import type { SessionWorkflowSnapshot } from "../../../shared/types";

export function WorkflowControls({
  workflow,
  onContinueStimulation,
  onRequestGrounding,
  onBeginClosure,
  onRequestReview
}: {
  workflow: SessionWorkflowSnapshot["state"];
  onContinueStimulation: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
}) {
  return (
    <div className="workflowControls">
      {(workflow === "interjection" || workflow === "closure") && (
        <button onClick={onContinueStimulation}>Continue stimulation</button>
      )}
      {(workflow === "stimulation" || workflow === "closure") && (
        <button onClick={onRequestGrounding}>Grounding</button>
      )}
      {(workflow === "stimulation" || workflow === "interjection") && (
        <button onClick={onBeginClosure}>Begin closure</button>
      )}
      {workflow === "closure" && <button onClick={onRequestReview}>Request review</button>}
    </div>
  );
}
