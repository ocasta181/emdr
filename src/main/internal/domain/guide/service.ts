import type {
  GuideActionProposal,
  GuideActionResult,
  GuideAdvanceSessionFlowAction,
  GuideAssessment,
  GuideAssessmentPatch,
  GuideAgentPort,
  GuideAgentResponse,
  GuideMessageRequest,
  GuideSessionFlowAction,
  GuideSessionFlowValidator,
  GuideSessionMutator,
  GuideSessionReader,
  GuideStimulationSetWriter,
  GuideTargetMutator,
  GuideTargetReader,
  GuideTargetSummary,
  GuideView,
  GuideViewRequest
} from "./types.js";

export class GuideService {
  private targetIntake:
    | {
        description: string;
        emotions?: string;
        disturbance?: number;
        negativeCognition?: string;
      }
    | undefined;

  constructor(
    private readonly targets: GuideTargetReader & GuideTargetMutator,
    private readonly sessions: GuideSessionReader & GuideSessionMutator & GuideSessionFlowValidator,
    private readonly stimulationSets: GuideStimulationSetWriter,
    private readonly agent?: GuideAgentPort
  ) {}

  getView(request: GuideViewRequest): GuideView {
    const currentTargets = this.targets.listCurrentTargets();

    if (!request.activeSessionId) {
      return idleGuideView(currentTargets);
    }

    const workflow = this.sessions.currentSessionWorkflow();
    if (workflow.activeSessionId !== request.activeSessionId) {
      return idleGuideView(currentTargets);
    }

    const session = this.sessions.listSessions().find((item) => item.id === request.activeSessionId);
    if (!session || session.endedAt) {
      return idleGuideView(currentTargets);
    }

    const target = this.targets.listAllTargets().find((item) => item.id === session.targetId);
    const targetDescription = target?.description ?? "Unknown target";

    return {
      mode: "session",
      targetCount: currentTargets.length,
      messages: [`Started session for "${targetDescription}".`],
      activeSession: {
        sessionId: session.id,
        targetId: session.targetId,
        targetDescription,
        workflowState: workflow.state,
        stimulationSetCount: session.stimulationSets.length
      }
    };
  }

  async respondToMessage(request: GuideMessageRequest): Promise<GuideAgentResponse> {
    const view = this.getView({ activeSessionId: request.activeSessionId });
    const workflow = this.sessions.currentSessionWorkflow();

    const targetIntakeResponse = this.respondToTargetIntake(request.message, view, workflow);
    if (targetIntakeResponse) {
      return targetIntakeResponse;
    }

    this.targetIntake = undefined;

    if (!this.agent) {
      return fallbackGuideResponse(request.message, view, workflow);
    }

    return this.agent.respond({
      message: request.message,
      view,
      workflow
    });
  }

  applyAction(proposal: GuideActionProposal): GuideActionResult {
    if (proposal.type === "advance_session_flow") {
      return this.applyActiveSessionProposal(proposal, proposal.action, () => {
        const workflow = this.sessions.advanceSessionFlow(proposal.action, proposal.sessionId);
        return { result: workflow, workflow };
      });
    }

    if (proposal.type === "update_assessment") {
      return this.applyActiveSessionProposal(proposal, "update_assessment", () => {
        const session = this.sessions.listSessions().find((item) => item.id === proposal.sessionId);
        if (!session || session.endedAt) {
          throw new Error(`Session not found: ${proposal.sessionId}`);
        }
        const result = this.sessions.updateAssessment(
          proposal.sessionId,
          assessmentFromPatch(session.assessment, proposal.assessment)
        );
        return {
          result,
          workflow: this.sessions.currentSessionWorkflow()
        };
      });
    }

    if (proposal.type === "log_stimulation_set") {
      return this.applyActiveSessionProposal(proposal, "log_stimulation_set", () => {
        const result = this.stimulationSets.logStimulationSet({
          sessionId: proposal.sessionId,
          cycleCount: proposal.cycleCount,
          observation: proposal.observation,
          disturbance: proposal.disturbance
        });
        return {
          result,
          workflow: this.sessions.currentSessionWorkflow()
        };
      });
    }

    return this.applyActiveSessionProposal(proposal, "close_session", () => {
      const result = this.sessions.endSession(proposal.sessionId, {
        finalDisturbance: proposal.finalDisturbance,
        notes: proposal.notes
      });
      return { result, workflow: this.sessions.currentSessionWorkflow() };
    });
  }

  private applyActiveSessionProposal(
    proposal: Extract<GuideActionProposal, { sessionId: string }>,
    flowAction: GuideSessionFlowAction,
    apply: () => { result: unknown; workflow: { state: GuideActionProposal["workflowState"]; activeSessionId?: string } }
  ): GuideActionResult {
    const workflow = this.sessions.currentSessionWorkflow();
    if (workflow.activeSessionId !== proposal.sessionId || workflow.state !== proposal.workflowState) {
      return {
        accepted: false,
        workflow,
        reason: `Action ${proposal.type} expected ${proposal.workflowState}, but session is in ${workflow.state}.`
      };
    }

    return this.applyValidatedWorkflowAction(workflow.state, flowAction, apply);
  }

  private applyValidatedWorkflowAction(
    workflowState: GuideActionProposal["workflowState"],
    flowAction: GuideSessionFlowAction,
    apply: () => { result: unknown; workflow: { state: GuideActionProposal["workflowState"]; activeSessionId?: string } }
  ): GuideActionResult {
    const workflow = this.sessions.currentSessionWorkflow();
    if (workflow.state !== workflowState) {
      return {
        accepted: false,
        workflow,
        reason: `Action ${flowAction} expected ${workflowState}, but session is in ${workflow.state}.`
      };
    }

    if (!this.sessions.canApplySessionFlowAction(workflowState, flowAction)) {
      return {
        accepted: false,
        workflow,
        reason: `Action ${flowAction} is not allowed from ${workflowState}.`
      };
    }

    const applied = apply();
    return {
      accepted: true,
      workflow: applied.workflow,
      result: applied.result
    };
  }

  private respondToTargetIntake(
    message: string,
    view: GuideView,
    workflow: { state: GuideActionProposal["workflowState"]; activeSessionId?: string }
  ): GuideAgentResponse | undefined {
    const text = message.trim();
    if (view.mode !== "idle" || workflow.state !== "target_selection" || !text) {
      return undefined;
    }

    const needsTargetPrompt = !this.targetIntake && /\b(help|not sure|unsure|don't know|do not know)\b/i.test(text);
    if (needsTargetPrompt) {
      return {
        messages: [
          "Start with any doorway into it: a current trigger, brief image, body sensation, self-belief, or future situation. A few words are enough."
        ],
        proposals: []
      };
    }

    if (!this.targetIntake) {
      this.targetIntake = { description: text };
      return {
        messages: ["What emotion or body sensation comes up with that now?"],
        proposals: []
      };
    }

    if (!this.targetIntake.emotions) {
      this.targetIntake = { ...this.targetIntake, emotions: text };
      return {
        messages: ["From 0 to 10, how disturbing does it feel right now?"],
        proposals: []
      };
    }

    if (this.targetIntake.disturbance === undefined) {
      const disturbance = disturbanceScoreFrom(text);
      if (disturbance === undefined) {
        return {
          messages: ["Enter a number from 0 to 10 for how disturbing it feels right now."],
          proposals: []
        };
      }

      this.targetIntake = { ...this.targetIntake, disturbance };
      return {
        messages: ["What negative self-belief comes with it? A short 'I...' phrase is enough, or write 'not sure'."],
        proposals: []
      };
    }

    if (!this.targetIntake.negativeCognition) {
      this.targetIntake = { ...this.targetIntake, negativeCognition: text };
      return {
        messages: ["What would you rather believe about yourself now? A short 'I can...' or 'I am...' phrase is enough."],
        proposals: []
      };
    }

    this.targets.addTarget({
      description: this.targetIntake.description,
      negativeCognition: this.targetIntake.negativeCognition ?? "",
      positiveCognition: text
    });
    this.targetIntake = undefined;

    return {
      messages: [
        "Target note saved. Before starting, review the full assessment: image, body sensation, disturbance, and how true that positive belief feels from 1 to 7."
      ],
      proposals: []
    };
  }
}

function assessmentFromPatch(current: GuideAssessment, patch: GuideAssessmentPatch): GuideAssessment {
  return {
    ...current,
    ...patch,
    negativeCognition: patch.negativeCognition ?? current.negativeCognition,
    positiveCognition: patch.positiveCognition ?? current.positiveCognition
  };
}

function idleGuideView(targets: GuideTargetSummary[]): GuideView {
  const targetCount = targets.length;
  const [nextTarget] = targets;
  const emptyTargetMessage =
    "Let's make a target note. Use a brief label, not the full story: a past event, current trigger, image, body sensation, or future situation for EMDR.";
  const singleTargetMessage = `Ready to continue with "${nextTarget?.description ?? "the active target"}". You can work with this target or make another brief target note.`;

  return {
    mode: "idle",
    targetCount,
    messages: [
      targetCount === 0
        ? emptyTargetMessage
        : targetCount === 1
          ? singleTargetMessage
          : `There are ${targetCount} active target notes. Tell me which one feels most useful to continue, or add another brief target note.`
    ]
  };
}

function fallbackGuideResponse(
  message: string,
  view: GuideView,
  workflow: { state: GuideActionProposal["workflowState"]; activeSessionId?: string }
): GuideAgentResponse {
  const description = message.trim();
  if (view.mode === "idle" && workflow.state === "target_selection" && description) {
    return {
      messages: ["What emotion or body sensation comes up with that now?"],
      proposals: []
    };
  }

  return {
    messages: [fallbackGuideMessage(view)],
    proposals: []
  };
}

function fallbackGuideMessage(view: GuideView) {
  if (view.mode === "session") {
    return "I noted that. Continue with the current session controls when you are ready.";
  }

  return (
    view.messages[0] ??
    "Use a brief label, not the full story: a past event, current trigger, image, body sensation, or future situation for EMDR."
  );
}

function disturbanceScoreFrom(text: string) {
  const numeric = text.match(/-?\d+(?:\.\d+)?/);
  if (numeric) {
    const score = Number(numeric[0]);
    if (score >= 0 && score <= 10) return score;
  }

  return wordDisturbanceScores.get(text.trim().toLowerCase());
}

const wordDisturbanceScores = new Map([
  ["zero", 0],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10]
]);
