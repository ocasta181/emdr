import type {
  GuideActionProposal,
  GuideActionResult,
  GuideSessionFlowAction,
  GuideSessionFlowValidator,
  GuideSessionMutator,
  GuideSessionReader,
  GuideStimulationSetWriter,
  GuideTargetReader,
  GuideView,
  GuideViewRequest
} from "./types.js";

export class GuideService {
  constructor(
    private readonly targets: GuideTargetReader,
    private readonly sessions: GuideSessionReader & GuideSessionMutator & GuideSessionFlowValidator,
    private readonly stimulationSets: GuideStimulationSetWriter
  ) {}

  getView(request: GuideViewRequest): GuideView {
    const currentTargets = this.targets.listCurrentTargets();

    if (!request.activeSessionId) {
      return idleGuideView(currentTargets.length);
    }

    const workflow = this.sessions.currentSessionWorkflow();
    if (workflow.activeSessionId !== request.activeSessionId) {
      return idleGuideView(currentTargets.length);
    }

    const session = this.sessions.listSessions().find((item) => item.id === request.activeSessionId);
    if (!session || session.endedAt) {
      return idleGuideView(currentTargets.length);
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

  applyAction(proposal: GuideActionProposal): GuideActionResult {
    const workflow = this.sessions.currentSessionWorkflow();
    if (workflow.activeSessionId !== proposal.sessionId || workflow.state !== proposal.workflowState) {
      return {
        accepted: false,
        workflow,
        reason: `Action ${proposal.type} expected ${proposal.workflowState}, but session is in ${workflow.state}.`
      };
    }

    if (proposal.type === "log_stimulation_set") {
      return this.applyValidatedAction(workflow.state, "log_stimulation_set", () => {
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

    return this.applyValidatedAction(workflow.state, "close_session", () => {
      const result = this.sessions.endSession(proposal.sessionId, {
        finalDisturbance: proposal.finalDisturbance,
        notes: proposal.notes
      });
      return { result, workflow: this.sessions.currentSessionWorkflow() };
    });
  }

  private applyValidatedAction(
    workflowState: GuideActionProposal["workflowState"],
    flowAction: GuideSessionFlowAction,
    apply: () => { result: unknown; workflow: { state: GuideActionProposal["workflowState"]; activeSessionId?: string } }
  ): GuideActionResult {
    if (!this.sessions.canApplySessionFlowAction(workflowState, flowAction)) {
      return {
        accepted: false,
        workflow: this.sessions.currentSessionWorkflow(),
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

function idleGuideView(targetCount: number): GuideView {
  return {
    mode: "idle",
    targetCount,
    messages: [
      targetCount === 0
        ? "We have no targets yet. Open Targets to add the first one."
        : `You have ${targetCount} active target${targetCount === 1 ? "" : "s"}. Pick one to start a session.`
    ],
    primaryAction: {
      type: "open_targets",
      label: "Open Targets"
    }
  };
}
