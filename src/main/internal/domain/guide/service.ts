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
        stimulationSetCount: session.stimulationSets.length
      }
    };
  }

  applyAction(proposal: GuideActionProposal): GuideActionResult {
    if (proposal.type === "log_stimulation_set") {
      return this.applyValidatedAction(proposal.flowState, "log_stimulation_set", () =>
        this.stimulationSets.logStimulationSet({
          sessionId: proposal.sessionId,
          cycleCount: proposal.cycleCount,
          observation: proposal.observation,
          disturbance: proposal.disturbance
        })
      );
    }

    return this.applyValidatedAction(proposal.flowState, "close_session", () =>
      this.sessions.endSession(proposal.sessionId, {
        finalDisturbance: proposal.finalDisturbance,
        notes: proposal.notes
      })
    );
  }

  private applyValidatedAction(
    flowState: GuideActionProposal["flowState"],
    flowAction: GuideSessionFlowAction,
    apply: () => unknown
  ): GuideActionResult {
    if (!this.sessions.canApplySessionFlowAction(flowState, flowAction)) {
      return {
        accepted: false,
        flowState,
        reason: `Action ${flowAction} is not allowed from ${flowState}.`
      };
    }

    return {
      accepted: true,
      flowState: this.sessions.nextSessionFlowState(flowState, flowAction),
      result: apply()
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
