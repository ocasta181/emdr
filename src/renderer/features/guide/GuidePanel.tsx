import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  Assessment,
  GuideActionProposal,
  GuideView,
  SessionAggregate,
  SessionWorkflowSnapshot
} from "../../../shared/types";
import { ScaleInput, sudAnchors, vocAnchors } from "../../components/ScaleInput";
import { AssessmentForm } from "../session/AssessmentForm";
import { WorkflowControls } from "../stimulation-set/WorkflowControls";

export type ChatMessage = { role: "guide" | "user"; text: string };

const sessionSteps: Array<{ label: string; states: SessionWorkflowSnapshot["state"][] }> = [
  { label: "Preparation", states: ["preparation"] },
  { label: "Sets", states: ["stimulation", "interjection"] },
  { label: "Closure", states: ["closure"] },
  { label: "Review", states: ["review", "post_session"] }
];

export type CompletedSessionSummary = { setCount: number; startSud?: number; endSud?: number };

export function IdleGuideChat({
  guideView,
  completedSession,
  suggestedTarget,
  onOpenTargets,
  onBegin
}: {
  guideView: GuideView;
  completedSession: CompletedSessionSummary | null;
  /** The target Start set would use; the guide names this one so the two never disagree. */
  suggestedTarget?: { description: string };
  onOpenTargets: () => void;
  onBegin?: () => void;
}) {
  const messages = suggestedTarget ? [`Ready to continue with "${suggestedTarget.description}".`] : guideView.messages;
  return (
    <div className="chatLog">
      {completedSession && (
        <section className="sessionSummary" aria-label="Session complete">
          <h2>Session complete</h2>
          <dl>
            <div>
              <dt>Sets</dt>
              <dd>{completedSession.setCount}</dd>
            </div>
            {(completedSession.startSud !== undefined || completedSession.endSud !== undefined) && (
              <div>
                <dt>SUD</dt>
                <dd>
                  {completedSession.startSud !== undefined && completedSession.endSud !== undefined
                    ? `${completedSession.startSud} → ${completedSession.endSud}`
                    : (completedSession.endSud ?? completedSession.startSud)}
                </dd>
              </div>
            )}
          </dl>
          <p>Take a moment before you continue. This session is saved in History.</p>
        </section>
      )}
      {messages.map((message, index) => (
        <p className="guideBubble" key={`${message}-${index}`}>
          {message}
        </p>
      ))}
      {onBegin && (
        <button className="primary" onClick={onBegin}>
          Begin session
        </button>
      )}
      {guideView.primaryAction?.type === "open_targets" && (
        <button className={onBegin ? undefined : "primary"} onClick={onOpenTargets}>
          {guideView.primaryAction.label}
        </button>
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
  chatMessages: ChatMessage[];
  chatDraft: string;
  guideProposals: GuideActionProposal[];
  onChatChange: (value: string) => void;
  onSubmitChat: (event: FormEvent) => void;
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
  const messages: ChatMessage[] = (guideView.mode === "session" ? guideView.messages : [])
    .map((text): ChatMessage => ({ role: "guide", text }))
    .concat(chatMessages);
  const workflowState = sessionView?.workflowState ?? workflow.state;
  const logRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef({ messages: messages.length, proposals: guideProposals.length });

  // Follow the conversation only when something new arrives, not when the panel first opens.
  useEffect(() => {
    const seen = seenRef.current;
    if (messages.length > seen.messages || guideProposals.length > seen.proposals) {
      logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
    }
    seenRef.current = { messages: messages.length, proposals: guideProposals.length };
  }, [messages.length, guideProposals.length]);

  // Each step's form sits at the top of the body, so a new step starts there.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [workflowState]);

  // Grounding pauses into the between-sets state; the exercise stays up until the person moves on.
  const [grounding, setGrounding] = useState(false);
  useEffect(() => {
    if (workflowState !== "interjection") setGrounding(false);
  }, [workflowState]);

  return (
    <>
      <div className="sessionHeader">
        <p className="sessionMeta">
          <span className="sessionTarget">{displayTargetDescription}</span>
          <span>
            {setCount} set{setCount === 1 ? "" : "s"} logged
          </span>
        </p>
        <SessionStepper state={workflowState} />
      </div>
      <div className="sessionBody" ref={bodyRef}>
        {grounding && <GroundingExercise onDone={() => setGrounding(false)} />}
        {workflowState === "preparation" && (
          <AssessmentForm
            assessment={session.assessment}
            onSave={onSaveAssessment}
            onApprove={onApproveAssessment}
          />
        )}
        {workflowState === "review" && (
          <SessionEndForm session={session} onEndSession={onEndSession} onBeginClosure={onBeginClosure} />
        )}
        {workflowState !== "review" && workflowState !== "post_session" && (
          <WorkflowControls
            workflow={workflowState}
            onStartSet={onStartSet}
            onRequestGrounding={() => {
              setGrounding(true);
              onRequestGrounding();
            }}
            onBeginClosure={onBeginClosure}
            onRequestReview={onRequestReview}
          />
        )}
        <div className="chatLog" ref={logRef}>
          {messages.map((message, index) => (
            <p className={message.role === "guide" ? "guideBubble" : "userBubble"} key={`${index}-${message.text}`}>
              {message.text}
            </p>
          ))}
          {guideProposals.map((proposal, index) => (
            <GuideProposalCard key={`${proposal.type}-${index}`} proposal={proposal} onApply={onApplyProposal} />
          ))}
        </div>
      </div>
      <form className="chatComposer" onSubmit={onSubmitChat}>
        <label>
          <span className="visuallyHidden">Note</span>
          <textarea
            rows={2}
            placeholder="Capture an in-session note…"
            value={chatDraft}
            onChange={(event) => onChatChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <button type="submit" disabled={!chatDraft.trim()}>
          Send
        </button>
      </form>
    </>
  );
}

function SessionStepper({ state }: { state: SessionWorkflowSnapshot["state"] }) {
  const currentIndex = sessionSteps.findIndex((step) => step.states.includes(state));
  return (
    <ol className="sessionStepper" aria-label="Session progress">
      {sessionSteps.map((step, index) => (
        <li
          key={step.label}
          className={index < currentIndex ? "done" : index === currentIndex ? "current" : undefined}
          aria-current={index === currentIndex ? "step" : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function GuideProposalCard({
  proposal,
  onApply
}: {
  proposal: GuideActionProposal;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  if (proposal.type === "create_target_draft") {
    return <CreateTargetProposal proposal={proposal} onApply={onApply} />;
  }

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

function CreateTargetProposal({
  proposal,
  onApply
}: {
  proposal: Extract<GuideActionProposal, { type: "create_target_draft" }>;
  onApply: (proposal: GuideActionProposal) => void;
}) {
  const [description, setDescription] = useState(proposal.description);
  const [negativeCognition, setNegativeCognition] = useState(proposal.negativeCognition ?? "");
  const [positiveCognition, setPositiveCognition] = useState(proposal.positiveCognition ?? "");

  return (
    <div className="proposalCard">
      <h2>Review proposed target</h2>
      <label>
        Description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label>
        Negative cognition
        <input value={negativeCognition} onChange={(event) => setNegativeCognition(event.target.value)} />
      </label>
      <label>
        Positive cognition
        <input value={positiveCognition} onChange={(event) => setPositiveCognition(event.target.value)} />
      </label>
      <button
        type="button"
        className="primary"
        onClick={() => onApply({ ...proposal, description, negativeCognition, positiveCognition })}
      >
        Apply target draft
      </button>
    </div>
  );
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
      <ScaleInput label="VOC" anchors={vocAnchors} min={1} max={7} value={assessment.believability} onChange={(value) => set("believability", value)} />
      <ScaleInput label="SUD" anchors={sudAnchors} min={0} max={10} value={assessment.disturbance} onChange={(value) => set("disturbance", value)} />
      <label>
        Emotions
        <input value={assessment.emotions ?? ""} onChange={(event) => set("emotions", event.target.value)} />
      </label>
      <label>
        Body location
        <input value={assessment.bodyLocation ?? ""} onChange={(event) => set("bodyLocation", event.target.value)} />
      </label>
      <button type="button" className="primary" onClick={() => onApply({ ...proposal, assessment })}>
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
      <button type="button" className="primary" onClick={() => onApply(proposal)}>
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
      <ScaleInput label="Set SUD" anchors={sudAnchors} min={0} max={10} value={disturbance} onChange={setDisturbance} />
      <button
        type="button"
        className="primary"
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
      <ScaleInput label="Final SUD" anchors={sudAnchors} min={0} max={10} value={finalDisturbance} onChange={setFinalDisturbance} />
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button
        type="button"
        className="primary"
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
      <ScaleInput label="Final SUD" anchors={sudAnchors} min={0} max={10} value={finalDisturbance} onChange={setFinalDisturbance} />
      <label>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="buttonRow">
        <button type="submit" className="primary">
          End session
        </button>
        <button type="button" onClick={onBeginClosure}>
          Return to closure
        </button>
      </div>
    </form>
  );
}

function sessionFlowActionLabel(action: Extract<GuideActionProposal, { type: "advance_session_flow" }>["action"]) {
  if (action === "continue_stimulation") return "Continue stimulation";
  if (action === "request_grounding") return "Request grounding";
  if (action === "begin_closure") return "Begin closure";
  return "Request review";
}

function GroundingExercise({ onDone }: { onDone: () => void }) {
  return (
    <section className="groundingCard" aria-label="Grounding">
      <h2>Grounding</h2>
      <p>Feel your feet on the floor and breathe out slowly. Then gently notice:</p>
      <ol>
        <li>5 things you can see</li>
        <li>4 things you can feel</li>
        <li>3 things you can hear</li>
        <li>2 things you can smell</li>
        <li>1 thing you can taste</li>
      </ol>
      <button type="button" onClick={onDone}>
        I feel steadier
      </button>
    </section>
  );
}
