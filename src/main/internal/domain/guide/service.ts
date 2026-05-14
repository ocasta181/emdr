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

    if (!this.agent) {
      return {
        messages: [fallbackGuideMessage(view)],
        proposals: []
      };
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
  return {
    mode: "idle",
    targetCount,
    messages: [
      targetCount === 0
        ? "We have no targets yet. Open Targets to add the first one."
        : targetCount === 1
          ? `Ready to continue with "${nextTarget?.description ?? "the active target"}".`
          : `Ready to continue with the guide-prioritized target across ${targetCount} active targets.`
    ],
    primaryAction: {
      type: "open_targets",
      label: "Open Targets"
    }
  };
}

function fallbackGuideMessage(view: GuideView) {
  if (view.mode === "session") {
    return "I noted that. Continue with the current session controls when you are ready.";
  }

  return view.messages[0] ?? "Open Targets to choose what to work on.";
}
