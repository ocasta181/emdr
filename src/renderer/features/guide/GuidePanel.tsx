import { useState, type FormEvent } from "react";
import type {
  Assessment,
  GuideActionProposal,
  GuideView,
  SessionAggregate,
  SessionWorkflowSnapshot
} from "../../../shared/types";
import { optionalNumber } from "../../../../utils";
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
  onEndSession: (patch: { finalDisturbance?: number; notes?: string }) => void;
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
        <div className="proposalList">
          {guideProposals.map((proposal, index) => (
            <GuideProposalCard
              key={`${proposal.type}-${index}`}
              proposal={proposal}
              onApply={onApplyProposal}
            />
          ))}
        </div>
      )}
      {workflowState === "review" && (
        <SessionEndForm session={session} onEndSession={onEndSession} onBeginClosure={onBeginClosure} />
      )}
    </>
  );
}

function GuideProposalCard({
  proposal,
  onApply
}: {
  proposal: GuideActionProposal;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  if (proposal.type === "log_stimulation_set") {
    return <LogStimulationSetProposal proposal={proposal} onApply={onApply} />;
  }

  return <EndSessionProposal proposal={proposal} onApply={onApply} />;
}

function LogStimulationSetProposal({
  proposal,
  onApply
}: {
  proposal: Extract<GuideActionProposal, { type: "log_stimulation_set" }>;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  const [observation, setObservation] = useState(proposal.observation);
  const [disturbance, setDisturbance] = useState(proposal.disturbance);

  return (
    <div className="proposalCard">
      <h2>Review proposed set</h2>
      <label>
        Set observation
        <textarea value={observation} onChange={(event) => setObservation(event.target.value)} />
      </label>
      <label>
        Set SUD
        <input
          type="number"
          min="0"
          max="10"
          value={disturbance ?? ""}
          onChange={(event) => setDisturbance(optionalNumber(event.target.value))}
        />
      </label>
      <button
        type="button"
        onClick={() => onApply({ ...proposal, observation, disturbance })}
      >
        Apply logged set
      </button>
    </div>
  );
}

function EndSessionProposal({
  proposal,
  onApply
}: {
  proposal: Extract<GuideActionProposal, { type: "end_session" }>;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  const [finalDisturbance, setFinalDisturbance] = useState(proposal.finalDisturbance);
  const [notes, setNotes] = useState(proposal.notes ?? "");

  return (
    <div className="proposalCard">
      <h2>Review proposed close</h2>
      <label>
        Final SUD
        <input
          type="number"
          min="0"
          max="10"
          value={finalDisturbance ?? ""}
          onChange={(event) => setFinalDisturbance(optionalNumber(event.target.value))}
        />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => onApply({ ...proposal, finalDisturbance, notes: notes.trim() || undefined })}
      >
        Apply session end
      </button>
    </div>
  );
}

function SessionEndForm({
  session,
  onEndSession,
  onBeginClosure
}: {
  session: SessionAggregate;
  onEndSession: (patch: { finalDisturbance?: number; notes?: string }) => void;
  onBeginClosure: () => void;
}) {
  const [finalDisturbance, setFinalDisturbance] = useState(session.finalDisturbance);
  const [notes, setNotes] = useState(session.notes ?? "");

  return (
    <form
      className="form workflowForm"
      onSubmit={(event) => {
        event.preventDefault();
        onEndSession({ finalDisturbance, notes: notes.trim() || undefined });
      }}
    >
      <label>
        Final SUD
        <input
          type="number"
          min="0"
          max="10"
          value={finalDisturbance ?? ""}
          onChange={(event) => setFinalDisturbance(optionalNumber(event.target.value))}
        />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="buttonRow">
        <button type="submit">End session</button>
        <button type="button" onClick={onBeginClosure}>
          Return to closure
        </button>
      </div>
    </form>
  );
}

function workflowLabel(state: SessionWorkflowSnapshot["state"]) {
  return state
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
