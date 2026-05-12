import assert from "node:assert/strict";
import test from "node:test";
import { GuideService } from "../dist-electron/src/main/internal/domain/guide/service.js";
import {
  nextSessionFlowState,
  SessionWorkflowMachine
} from "../dist-electron/src/main/internal/domain/session/service.js";

test("session state graph permits only defined workflow edges", () => {
  assert.equal(nextSessionFlowState("idle", "start_session"), "target_selection");
  assert.equal(nextSessionFlowState("target_selection", "select_target"), "preparation");
  assert.equal(nextSessionFlowState("review", "close_session"), "post_session");

  assert.throws(() => nextSessionFlowState("preparation", "log_stimulation_set"), /not allowed/);
  assert.throws(() => nextSessionFlowState("stimulation", "close_session"), /not allowed/);
});

test("session workflow machine carries the active session through the graph", () => {
  const workflow = new SessionWorkflowMachine();
  const sessionId = "ses_test";

  assert.deepEqual(workflow.currentSessionWorkflow(), { state: "idle" });
  assert.deepEqual(workflow.advanceSessionFlow("start_session"), { state: "target_selection" });
  assert.deepEqual(workflow.startSession(sessionId), { state: "preparation", activeSessionId: sessionId });

  assert.throws(() => workflow.advanceSessionFlow("pause_stimulation", "ses_other"), /not the active workflow session/);
  assert.throws(() => workflow.advanceSessionFlow("log_stimulation_set", sessionId), /must be applied by its domain command/);

  assert.deepEqual(workflow.advanceSessionFlow("approve_assessment", sessionId), {
    state: "stimulation",
    activeSessionId: sessionId
  });
  assert.deepEqual(workflow.applyActiveSessionAction(sessionId, "log_stimulation_set"), {
    state: "stimulation",
    activeSessionId: sessionId
  });
  assert.deepEqual(workflow.advanceSessionFlow("pause_stimulation", sessionId), {
    state: "interjection",
    activeSessionId: sessionId
  });
  assert.deepEqual(workflow.advanceSessionFlow("begin_closure", sessionId), {
    state: "closure",
    activeSessionId: sessionId
  });
  assert.deepEqual(workflow.advanceSessionFlow("request_review", sessionId), {
    state: "review",
    activeSessionId: sessionId
  });
  assert.deepEqual(workflow.applyActiveSessionAction(sessionId, "close_session"), {
    state: "post_session",
    activeSessionId: sessionId
  });
  assert.deepEqual(workflow.advanceSessionFlow("return_to_idle", sessionId), { state: "idle" });
});

test("guide service rejects stale or disallowed action proposals before mutation", () => {
  const { guide, calls } = createGuideHarness("preparation");

  const stale = guide.applyAction({
    type: "log_stimulation_set",
    sessionId: "ses_test",
    workflowState: "stimulation",
    cycleCount: 24,
    observation: "stale"
  });
  assert.equal(stale.accepted, false);
  assert.match(stale.reason, /expected stimulation, but session is in preparation/);

  const premature = guide.applyAction({
    type: "log_stimulation_set",
    sessionId: "ses_test",
    workflowState: "preparation",
    cycleCount: 24,
    observation: "too early"
  });
  assert.equal(premature.accepted, false);
  assert.match(premature.reason, /not allowed from preparation/);
  assert.deepEqual(calls, []);
});

test("guide service applies allowed actions through domain service ports", () => {
  const stimulationHarness = createGuideHarness("stimulation");
  const logged = stimulationHarness.guide.applyAction({
    type: "log_stimulation_set",
    sessionId: "ses_test",
    workflowState: "stimulation",
    cycleCount: 32,
    observation: "clearer",
    disturbance: 3
  });

  assert.equal(logged.accepted, true);
  assert.deepEqual(stimulationHarness.calls, [
    {
      type: "log",
      draft: {
        sessionId: "ses_test",
        cycleCount: 32,
        observation: "clearer",
        disturbance: 3
      }
    }
  ]);

  const reviewHarness = createGuideHarness("review");
  const ended = reviewHarness.guide.applyAction({
    type: "end_session",
    sessionId: "ses_test",
    workflowState: "review",
    finalDisturbance: 1,
    notes: "complete"
  });

  assert.equal(ended.accepted, true);
  assert.deepEqual(ended.workflow, { state: "post_session", activeSessionId: "ses_test" });
  assert.deepEqual(reviewHarness.calls, [
    {
      type: "end",
      sessionId: "ses_test",
      patch: { finalDisturbance: 1, notes: "complete" }
    }
  ]);
});

function createGuideHarness(state) {
  const target = { id: "tar_test", description: "Test target" };
  const calls = [];
  let workflow = { state, activeSessionId: "ses_test" };
  const workflowRules = new SessionWorkflowMachine();

  const guide = new GuideService(
    {
      listCurrentTargets: () => [target],
      listAllTargets: () => [target]
    },
    {
      listSessions: () => [
        {
          id: "ses_test",
          targetId: target.id,
          stimulationSets: [],
          endedAt: undefined
        }
      ],
      endSession: (sessionId, patch) => {
        calls.push({ type: "end", sessionId, patch });
        workflow = { state: "post_session", activeSessionId: sessionId };
        return { id: sessionId, endedAt: "2026-05-12T00:00:00.000Z" };
      },
      canApplySessionFlowAction: (currentState, action) =>
        workflowRules.canApplySessionFlowAction(currentState, action),
      currentSessionWorkflow: () => workflow
    },
    {
      logStimulationSet: (draft) => {
        calls.push({ type: "log", draft });
        return { id: "set_test", ...draft };
      }
    }
  );

  return { guide, calls };
}
