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
    if (proposal.type === "create_target_draft") {
      return this.applyValidatedWorkflowAction(proposal.workflowState, "create_target_draft", () => {
        const result = this.targets.addTarget({
          description: proposal.description,
          negativeCognition: proposal.negativeCognition ?? "",
          positiveCognition: proposal.positiveCognition ?? ""
        });
        return { result, workflow: this.sessions.currentSessionWorkflow() };
      });
    }

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
        messages: ["What memory, image, or situation feels useful to focus on right now? A few words are enough."],
        proposals: []
      };
    }

    if (!this.targetIntake) {
      this.targetIntake = { description: text };
      return {
        messages: ["How does that make you feel right now?"],
        proposals: []
      };
    }

    if (!this.targetIntake.emotions) {
      this.targetIntake = { ...this.targetIntake, emotions: text };
      return {
        messages: ["What subjective disturbance score would you give that feeling from 0 to 10?"],
        proposals: []
      };
    }

    if (this.targetIntake.disturbance === undefined) {
      const disturbance = disturbanceScoreFrom(text);
      if (disturbance === undefined) {
        return {
          messages: ["Please give a subjective disturbance score from 0 to 10."],
          proposals: []
        };
      }

      this.targetIntake = { ...this.targetIntake, disturbance };
      return {
        messages: ["What negative cognition goes with it?"],
        proposals: []
      };
    }

    if (!this.targetIntake.negativeCognition) {
      this.targetIntake = { ...this.targetIntake, negativeCognition: text };
      return {
        messages: ["What positive cognition would you rather hold with this target?"],
        proposals: []
      };
    }

    const proposal = {
      type: "create_target_draft",
      workflowState: workflow.state,
      description: this.targetIntake.description,
      negativeCognition: this.targetIntake.negativeCognition,
      positiveCognition: text
    } satisfies GuideActionProposal;
    this.targetIntake = undefined;

    return {
      messages: ["Review the target draft below."],
      proposals: [proposal]
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
    "I can help identify a target. Tell me the memory, image, or situation you want to focus on.";
  const singleTargetMessage = `Ready to continue with "${nextTarget?.description ?? "the active target"}". Tell me if you want to work with this target or shape another one.`;

  return {
    mode: "idle",
    targetCount,
    messages: [
      targetCount === 0
        ? emptyTargetMessage
        : targetCount === 1
          ? singleTargetMessage
          : `I can help choose among ${targetCount} active targets. Tell me what feels most useful to work on.`
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
      messages: ["How does that make you feel right now?"],
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

  return view.messages[0] ?? "Tell me the memory, image, or situation you want to focus on.";
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
