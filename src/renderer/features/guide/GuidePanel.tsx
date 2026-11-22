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
import {
  pendingQuestion,
  preparationQuestions,
  reviewQuestions,
  setReflectionQuestions,
  type GuidedQuestion,
  type ReviewDraft
} from "./guidedSession";
import { crisisCopy, signalsCrisis } from "./safety";

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
  onRecordSetObservation,
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
  onRecordSetObservation: (setId: string, observation: string, disturbance: number | undefined) => void;
  onStartSet: () => void;
  onRequestGrounding: () => void;
  onBeginClosure: () => void;
  onRequestReview: () => void;
  onEndSession: (patch: { finalDisturbance?: number; notes?: string }) => void;
}) {
  const sessionView = guideView.mode === "session" ? guideView.activeSession : undefined;
  const displayTargetDescription = sessionView?.targetDescription ?? targetDescription ?? "Unknown target";
  const setCount = sessionView?.stimulationSetCount ?? session.stimulationSets.length;
  const workflowState = sessionView?.workflowState ?? workflow.state;
  const stepIntro = guideView.mode === "session" ? guideView.messages : [];

  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [grounding, setGrounding] = useState(false);
  const [crisis, setCrisis] = useState(false);

  const latestSet = [...session.stimulationSets].sort((a, b) => b.setNumber - a.setNumber)[0];
  const questions: GuidedQuestion[] =
    workflowState === "preparation"
      ? preparationQuestions(session.assessment)
      : workflowState === "interjection" && latestSet
        ? setReflectionQuestions(latestSet)
        : workflowState === "review"
          ? reviewQuestions(reviewDraft)
          : [];
  const pending = crisis || grounding ? undefined : pendingQuestion(questions, skipped);
  const answered = questions.filter((question) => question.answer !== undefined || skipped.has(question.id));
  const visibleAnswered = pending ? answered.filter((question) => questions.indexOf(question) < questions.indexOf(pending)) : answered;

  // Grounding pauses into the between-sets state; the exercise stays up until the person moves on.
  useEffect(() => {
    if (workflowState !== "interjection") setGrounding(false);
    setEditingDetails(false);
  }, [workflowState]);

  const logRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const conversationSize = visibleAnswered.length + chatMessages.length + guideProposals.length + (pending ? 1 : 0);
  // Keep the newest exchange and whatever comes after it (summary, next actions) in view.
  useEffect(() => {
    const body = bodyRef.current;
    body?.scrollTo({ top: body.scrollHeight });
  }, [conversationSize, workflowState]);

  function skip(question: GuidedQuestion) {
    setSkipped((current) => new Set(current).add(question.id));
  }

  function answer(question: GuidedQuestion, value: string | number) {
    if (question.id.startsWith("assessment.")) {
      const field = question.id.slice("assessment.".length) as keyof Assessment;
      onSaveAssessment({ ...session.assessment, [field]: value });
      return;
    }
    if (question.id.startsWith("set.") && latestSet) {
      if (question.id.endsWith(".observation")) {
        onRecordSetObservation(latestSet.id, String(value), latestSet.disturbance);
      } else {
        onRecordSetObservation(latestSet.id, latestSet.observation, Number(value));
      }
      return;
    }
    if (question.id === "review.finalDisturbance") setReviewDraft((draft) => ({ ...draft, finalDisturbance: Number(value) }));
    if (question.id === "review.notes") setReviewDraft((draft) => ({ ...draft, notes: String(value) }));
  }

  function submitComposer(event: FormEvent) {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    if (signalsCrisis(text)) {
      // Fixed copy from code; the message is not forwarded to the guide agent.
      setCrisis(true);
      onChatChange("");
      return;
    }
    if (pending?.input.kind === "text") {
      answer(pending, text);
      onChatChange("");
      return;
    }
    onSubmitChat(event);
  }

  const answeringText = pending?.input.kind === "text";
  const showComposer = !pending || answeringText;
  const preparationDone = workflowState === "preparation" && !pending;
  const reviewDone = workflowState === "review" && !pending;
  const reflectionDone = (workflowState === "interjection" || workflowState === "closure" || workflowState === "stimulation") && !pending;

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
        <div className="chatLog" ref={logRef} aria-live="polite">
          {stepIntro.map((text, index) => (
            <p className="guideBubble" key={`intro-${index}-${text}`}>
              {text}
            </p>
          ))}
          {visibleAnswered.map((question) => (
            <div className="exchange" key={question.id}>
              <p className="guideBubble">{question.prompt}</p>
              {question.answer !== undefined ? (
                <p className="userBubble">
                  {question.input.kind === "scale" ? `${question.input.label} ${question.answer}` : question.answer}
                </p>
              ) : (
                <p className="skippedNote">Skipped</p>
              )}
            </div>
          ))}
          {chatMessages.map((message, index) => (
            <p className={message.role === "guide" ? "guideBubble" : "userBubble"} key={`${index}-${message.text}`}>
              {message.text}
            </p>
          ))}
          {guideProposals.map((proposal, index) => (
            <GuideProposalCard key={`${proposal.type}-${index}`} proposal={proposal} onApply={onApplyProposal} />
          ))}
          {crisis && (
            <section className="crisisCard" role="alert">
              <p>{crisisCopy}</p>
              <div className="buttonRow">
                <button type="button" onClick={() => setCrisis(false)}>
                  I am safe to continue
                </button>
                {workflowState !== "closure" && workflowState !== "review" && (
                  <button type="button" onClick={onBeginClosure}>
                    Begin closure
                  </button>
                )}
              </div>
            </section>
          )}
          {grounding && !crisis && <GroundingExercise onDone={() => setGrounding(false)} />}
          {pending && (
            <div className="exchange pending" key={pending.id}>
              <p className="guideBubble">{pending.prompt}</p>
              {pending.input.kind === "scale" && (
                <ScaleInput
                  label={pending.input.label}
                  anchors={pending.input.anchors}
                  min={pending.input.min}
                  max={pending.input.max}
                  value={undefined}
                  onChange={(value) => value !== undefined && answer(pending, value)}
                />
              )}
              <button type="button" className="quiet skipButton" onClick={() => skip(pending)}>
                Skip
              </button>
            </div>
          )}
        </div>

        {preparationDone && !crisis && (
          <section className="stepSummary">
            <h2>Ready when you are</h2>
            <AssessmentSummary assessment={session.assessment} />
            {editingDetails ? (
              <AssessmentForm assessment={session.assessment} onSave={onSaveAssessment} onApprove={onApproveAssessment} />
            ) : (
              <div className="buttonRow">
                <button type="button" className="primary" onClick={onStartSet}>
                  Begin bilateral stimulation
                </button>
                <button type="button" className="quiet" onClick={() => setEditingDetails(true)}>
                  Edit details
                </button>
              </div>
            )}
          </section>
        )}

        {reviewDone && (
          <section className="stepSummary">
            <h2>Session summary</h2>
            <dl className="summaryList">
              <div>
                <dt>Sets</dt>
                <dd>{setCount}</dd>
              </div>
              <div>
                <dt>SUD</dt>
                <dd>{formatSudChange(session.assessment.disturbance, reviewDraft.finalDisturbance)}</dd>
              </div>
            </dl>
            <div className="buttonRow">
              <button
                type="button"
                className="primary"
                onClick={() => onEndSession({ finalDisturbance: reviewDraft.finalDisturbance, notes: reviewDraft.notes })}
              >
                End session
              </button>
              <button type="button" onClick={onBeginClosure}>
                Return to closure
              </button>
            </div>
          </section>
        )}

        {reflectionDone && !crisis && (
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
      </div>
      {showComposer && (
        <form className="chatComposer" onSubmit={submitComposer}>
          <label>
            <span className="visuallyHidden">{answeringText ? "Your answer" : "Note"}</span>
            <textarea
              rows={2}
              placeholder={answeringText && pending?.input.kind === "text" ? pending.input.placeholder : "Write to the guide…"}
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
          <button type="submit" className={answeringText ? "primary" : undefined} disabled={!chatDraft.trim()}>
            {answeringText ? "Answer" : "Send"}
          </button>
        </form>
      )}
    </>
  );
}

function AssessmentSummary({ assessment }: { assessment: Assessment }) {
  const rows: Array<[string, string | undefined]> = [
    ["Image", assessment.image?.trim()],
    ["Negative belief", assessment.negativeCognition.trim()],
    ["Preferred belief", assessment.positiveCognition.trim()],
    ["VOC", assessment.believability?.toString()],
    ["Emotions", assessment.emotions?.trim()],
    ["SUD", assessment.disturbance?.toString()],
    ["Body", assessment.bodyLocation?.trim()]
  ];
  return (
    <dl className="assessmentSummary">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function formatSudChange(start: number | undefined, end: number | undefined) {
  if (start !== undefined && end !== undefined) return `${start} → ${end}`;
  return String(end ?? start ?? "–");
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

  if (proposal.type === "record_set_observation") {
    return null;
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
