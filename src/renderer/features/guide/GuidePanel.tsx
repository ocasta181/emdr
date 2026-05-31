import { useState } from "react";
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
import { VoiceGuideComposer } from "./VoiceGuideComposer";

export type GuideChatMessage = {
  speaker: "user" | "guide";
  text: string;
};

export function IdleGuideChat({
  guideView,
  chatMessages,
  guideVoiceURI,
  chatDraft,
  guideProposals,
  onChatChange,
  onSubmitMessage,
  onGuideSpeakingChange,
  onApplyProposal
}: {
  guideView: GuideView;
  chatMessages: GuideChatMessage[];
  guideVoiceURI: string;
  chatDraft: string;
  guideProposals: GuideActionProposal[];
  onChatChange: (value: string) => void;
  onSubmitMessage: (message: string) => void;
  onGuideSpeakingChange: (isSpeaking: boolean) => void;
  onApplyProposal: (proposal: GuideActionProposal) => void;
}) {
  const messages: GuideChatMessage[] = [
    ...guideView.messages.map((text) => ({ speaker: "guide", text }) satisfies GuideChatMessage),
    ...chatMessages
  ];

  return (
    <GuideConversation
      messages={messages}
      guideVoiceURI={guideVoiceURI}
      chatDraft={chatDraft}
      guideProposals={guideProposals}
      placeholder="Say what feels useful to focus on..."
      onChatChange={onChatChange}
      onSubmitMessage={onSubmitMessage}
      onGuideSpeakingChange={onGuideSpeakingChange}
      onApplyProposal={onApplyProposal}
    />
  );
}

export function ActiveSessionChat({
  session,
  targetDescription,
  guideView,
  workflow,
  chatMessages,
  guideVoiceURI,
  chatDraft,
  guideProposals,
  onChatChange,
  onSubmitMessage,
  onGuideSpeakingChange,
  onApplyProposal,
  onSaveAssessment,
  onApproveAssessment,
  onStartSet,
  onRequestGrounding,
  onBeginClosure,
  onRequestReview,
  onEndSession
}: {
  session: SessionAggregate;
  targetDescription?: string;
  guideView: GuideView;
  workflow: SessionWorkflowSnapshot;
  chatMessages: GuideChatMessage[];
  guideVoiceURI: string;
  chatDraft: string;
  guideProposals: GuideActionProposal[];
  onChatChange: (value: string) => void;
  onSubmitMessage: (message: string) => void;
  onGuideSpeakingChange: (isSpeaking: boolean) => void;
  onApplyProposal: (proposal: GuideActionProposal) => void;
  onSaveAssessment: (assessment: Assessment) => void;
  onApproveAssessment: (assessment: Assessment) => void;
  onStartSet: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
  onEndSession: (patch: { finalDisturbance?: number; notes?: string }) => void;
}) {
  const sessionView = guideView.mode === "session" ? guideView.activeSession : undefined;
  const displayTargetDescription = sessionView?.targetDescription ?? targetDescription ?? "Unknown target";
  const setCount = sessionView?.stimulationSetCount ?? session.stimulationSets.length;
  const messages: GuideChatMessage[] = [
    ...(guideView.mode === "session" ? guideView.messages : []).map(
      (text) => ({ speaker: "guide", text }) satisfies GuideChatMessage
    ),
    ...chatMessages
  ];
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
      {workflowState !== "review" && workflowState !== "post_session" && (
        <WorkflowControls
          workflow={workflowState}
          onStartSet={onStartSet}
          onRequestGrounding={onRequestGrounding}
          onBeginClosure={onBeginClosure}
          onRequestReview={onRequestReview}
        />
      )}
      <GuideConversation
        messages={messages}
        guideVoiceURI={guideVoiceURI}
        chatDraft={chatDraft}
        guideProposals={guideProposals}
        placeholder="Capture an in-session note..."
        onChatChange={onChatChange}
        onSubmitMessage={onSubmitMessage}
        onGuideSpeakingChange={onGuideSpeakingChange}
        onApplyProposal={onApplyProposal}
      />
      {workflowState === "review" && (
        <SessionEndForm session={session} onEndSession={onEndSession} onBeginClosure={onBeginClosure} />
      )}
    </>
  );
}

function GuideConversation({
  messages,
  guideVoiceURI,
  chatDraft,
  guideProposals,
  placeholder,
  onChatChange,
  onSubmitMessage,
  onGuideSpeakingChange,
  onApplyProposal
}: {
  messages: GuideChatMessage[];
  guideVoiceURI: string;
  chatDraft: string;
  guideProposals: GuideActionProposal[];
  placeholder: string;
  onChatChange: (value: string) => void;
  onSubmitMessage: (message: string) => void;
  onGuideSpeakingChange: (isSpeaking: boolean) => void;
  onApplyProposal: (proposal: GuideActionProposal) => void;
}) {
  return (
    <>
      <ChatLog messages={messages} />
      <VoiceGuideComposer
        messages={messages}
        guideVoiceURI={guideVoiceURI}
        chatDraft={chatDraft}
        placeholder={placeholder}
        onChatChange={onChatChange}
        onSubmitMessage={onSubmitMessage}
        onGuideSpeakingChange={onGuideSpeakingChange}
      />
      {guideProposals.length > 0 && (
        <ProposalList proposals={guideProposals} onApply={onApplyProposal} />
      )}
    </>
  );
}

function ChatLog({ messages }: { messages: GuideChatMessage[] }) {
  return (
    <div className="chatLog" role="log" aria-label="Guide transcript">
      {messages.map((message, index) => (
        <p
          className={message.speaker === "guide" ? "guideBubble" : "userBubble"}
          key={`${message.speaker}-${message.text}-${index}`}
        >
          {message.text}
        </p>
      ))}
    </div>
  );
}

function ProposalList({
  proposals,
  onApply
}: {
  proposals: GuideActionProposal[];
  onApply: (proposal: GuideActionProposal) => void;
}) {
  return (
    <div className="proposalList">
      {proposals.map((proposal, index) => (
        <GuideProposalCard
          key={`${proposal.type}-${index}`}
          proposal={proposal}
          onApply={onApply}
        />
      ))}
    </div>
  );
}

function GuideProposalCard({
  proposal,
  onApply
}: {
  proposal: GuideActionProposal;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  if (proposal.type === "update_assessment") {
    return <UpdateAssessmentProposal proposal={proposal} onApply={onApply} />;
  }

  if (proposal.type === "advance_session_flow") {
    return <AdvanceSessionFlowProposal proposal={proposal} onApply={onApply} />;
  }

  if (proposal.type === "log_stimulation_set") {
    return <LogStimulationSetProposal proposal={proposal} onApply={onApply} />;
  }

  return <EndSessionProposal proposal={proposal} onApply={onApply} />;
}

function UpdateAssessmentProposal({
  proposal,
  onApply
}: {
  proposal: Extract<GuideActionProposal, { type: "update_assessment" }>;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  const [assessment, setAssessment] = useState<Partial<Assessment>>(proposal.assessment);

  function set<K extends keyof Assessment>(key: K, value: Assessment[K]) {
    setAssessment((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="proposalCard">
      <h2>Review proposed assessment</h2>
      <label>
        Image
        <textarea value={assessment.image ?? ""} onChange={(event) => set("image", event.target.value)} />
      </label>
      <label>
        Negative cognition
        <input
          value={assessment.negativeCognition ?? ""}
          onChange={(event) => set("negativeCognition", event.target.value)}
        />
      </label>
      <label>
        Positive cognition
        <input
          value={assessment.positiveCognition ?? ""}
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
            value={assessment.believability ?? ""}
            onChange={(event) => set("believability", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          SUD
          <input
            type="number"
            min="0"
            max="10"
            value={assessment.disturbance ?? ""}
            onChange={(event) => set("disturbance", optionalNumber(event.target.value))}
          />
        </label>
      </div>
      <label>
        Emotions
        <input value={assessment.emotions ?? ""} onChange={(event) => set("emotions", event.target.value)} />
      </label>
      <label>
        Body location
        <input value={assessment.bodyLocation ?? ""} onChange={(event) => set("bodyLocation", event.target.value)} />
      </label>
      <button type="button" onClick={() => onApply({ ...proposal, assessment })}>
        Apply assessment
      </button>
    </div>
  );
}

function AdvanceSessionFlowProposal({
  proposal,
  onApply
}: {
  proposal: Extract<GuideActionProposal, { type: "advance_session_flow" }>;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  return (
    <div className="proposalCard">
      <h2>Review proposed next step</h2>
      <p className="authNotice">{sessionFlowActionLabel(proposal.action)}</p>
      <button type="button" onClick={() => onApply(proposal)}>
        Apply next step
      </button>
    </div>
  );
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

function sessionFlowActionLabel(action: Extract<GuideActionProposal, { type: "advance_session_flow" }>["action"]) {
  if (action === "continue_stimulation") return "Continue stimulation";
  if (action === "request_grounding") return "Request grounding";
  if (action === "begin_closure") return "Begin closure";
  return "Request review";
}
