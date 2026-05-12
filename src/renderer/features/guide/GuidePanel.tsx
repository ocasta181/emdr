import type { FormEvent } from "react";
import type {
  Assessment,
  GuideActionProposal,
  GuideView,
  SessionAggregate,
  SessionWorkflowSnapshot
} from "../../../shared/types";
import { AssessmentForm } from "../session/AssessmentForm";
import { WorkflowControls } from "../stimulation-set/WorkflowControls";

export function IdleGuideChat({ guideView, onOpenTargets }: { guideView: GuideView; onOpenTargets: () => void }) {
  return (
    <div className="chatLog">
      {guideView.messages.map((message, index) => (
        <p className="guideBubble" key={`${message}-${index}`}>
          {message}
        </p>
      ))}
      {guideView.primaryAction?.type === "open_targets" && (
        <button onClick={onOpenTargets}>{guideView.primaryAction.label}</button>
      )}
    </div>
  );
}

export function ActiveSessionChat({
  session,
  targetDescription,
  guideView,
  workflow,
  chatMessages,
  chatDraft,
  guideProposals,
  onChatChange,
  onSubmitChat,
  onApplyProposal,
  onSaveAssessment,
  onApproveAssessment,
  onContinueStimulation,
  onRequestGrounding,
  onBeginClosure,
  onRequestReview,
  onEndSession
}: {
  session: SessionAggregate;
  targetDescription?: string;
  guideView: GuideView;
  workflow: SessionWorkflowSnapshot;
  chatMessages: string[];
  chatDraft: string;
  guideProposals: GuideActionProposal[];
  onChatChange: (value: string) => void;
  onSubmitChat: (event: FormEvent) => void;
  onApplyProposal: (proposal: GuideActionProposal) => void;
  onSaveAssessment: (assessment: Assessment) => void;
  onApproveAssessment: (assessment: Assessment) => void;
  onContinueStimulation: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
  onEndSession: () => void;
}) {
  const sessionView = guideView.mode === "session" ? guideView.activeSession : undefined;
  const displayTargetDescription = sessionView?.targetDescription ?? targetDescription ?? "Unknown target";
  const setCount = sessionView?.stimulationSetCount ?? session.stimulationSets.length;
  const messages = (guideView.mode === "session" ? guideView.messages : []).concat(chatMessages);
  const workflowState = sessionView?.workflowState ?? workflow.state;

  return (
    <>
      <p className="authNotice">
        {displayTargetDescription} · {workflowLabel(workflowState)} · {setCount} set
        {setCount === 1 ? "" : "s"} logged
      </p>
      {workflowState === "preparation" && (
        <AssessmentForm
          assessment={session.assessment}
          onSave={onSaveAssessment}
          onApprove={onApproveAssessment}
        />
      )}
      {workflowState !== "preparation" && workflowState !== "review" && workflowState !== "post_session" && (
        <WorkflowControls
          workflow={workflowState}
          onContinueStimulation={onContinueStimulation}
          onRequestGrounding={onRequestGrounding}
          onBeginClosure={onBeginClosure}
          onRequestReview={onRequestReview}
        />
      )}
      <div className="chatLog">
        {messages.map((message, index) => (
          <p className="userBubble" key={`${message}-${index}`}>
            {message}
          </p>
        ))}
      </div>
      <form className="chatComposer" onSubmit={onSubmitChat}>
        <label>
          Note
          <textarea
            placeholder="Capture an in-session note..."
            value={chatDraft}
            onChange={(event) => onChatChange(event.target.value)}
          />
        </label>
        <button type="submit">Send</button>
      </form>
      {guideProposals.length > 0 && (
        <div className="buttonRow">
          {guideProposals.map((proposal, index) => (
            <button key={`${proposal.type}-${index}`} onClick={() => onApplyProposal(proposal)}>
              {guideProposalLabel(proposal)}
            </button>
          ))}
        </div>
      )}
      {workflowState === "review" && (
        <div className="buttonRow">
          <button onClick={onEndSession}>End session</button>
          <button onClick={onBeginClosure}>Return to closure</button>
        </div>
      )}
    </>
  );
}

function guideProposalLabel(proposal: GuideActionProposal) {
  if (proposal.type === "log_stimulation_set") return "Apply logged set";
  return "Apply session end";
}

function workflowLabel(state: SessionWorkflowSnapshot["state"]) {
  return state
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
