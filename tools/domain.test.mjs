import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { GuideAgentSidecarClient } from "../dist-electron/src/main/internal/domain/guide/agent-client.js";
import { GuideService } from "../dist-electron/src/main/internal/domain/guide/service.js";
import { AgentSidecar, JsonLineAgentTransport } from "../dist-electron/src/main/internal/lib/agent/index.js";
import { loadAppConfig } from "../dist-electron/src/main/internal/lib/config/app-config.js";
import {
  nextSessionFlowState,
  SessionWorkflowMachine
} from "../dist-electron/src/main/internal/domain/session/service.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("app config uses defaults and rejects invalid configured files", () => {
  const defaultTemplatePath = path.join(repoRoot, "package.json");

  assert.deepEqual(loadAppConfig({}, [], { sqliteTemplatePath: defaultTemplatePath }), {
    sqliteTemplatePath: defaultTemplatePath,
    devServerUrl: undefined,
    userDataPath: undefined,
    useAnimatedUi: false,
    headless: false
  });
  assert.equal(loadAppConfig({ EMDR_LOCAL_UI: "animated" }, [], { sqliteTemplatePath: defaultTemplatePath }).useAnimatedUi, true);
  assert.equal(loadAppConfig({ EMDR_QA_HEADLESS: "1" }, [], { sqliteTemplatePath: defaultTemplatePath }).headless, true);
  assert.equal(
    loadAppConfig(
      { EMDR_SQLITE_TEMPLATE_PATH: path.join(repoRoot, "README.md") },
      [],
      { sqliteTemplatePath: defaultTemplatePath }
    ).sqliteTemplatePath,
    path.join(repoRoot, "README.md")
  );
  assert.throws(
    () =>
      loadAppConfig(
        { EMDR_SQLITE_TEMPLATE_PATH: path.join(repoRoot, "missing.sqlite") },
        [],
        { sqliteTemplatePath: defaultTemplatePath }
      ),
    /EMDR_SQLITE_TEMPLATE_PATH must point to an existing file/
  );
  assert.throws(
    () => loadAppConfig({}, [], { sqliteTemplatePath: path.join(repoRoot, "missing-default.sqlite") }),
    /EMDR_SQLITE_TEMPLATE_PATH must point to an existing file/
  );
});

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
  const targetHarness = createGuideHarness("target_selection");
  const createdTarget = targetHarness.guide.applyAction({
    type: "create_target_draft",
    workflowState: "target_selection",
    description: "Draft target",
    negativeCognition: "I am stuck",
    positiveCognition: "I can move"
  });

  assert.equal(createdTarget.accepted, true);
  assert.deepEqual(targetHarness.calls, [
    {
      type: "target",
      draft: {
        description: "Draft target",
        negativeCognition: "I am stuck",
        positiveCognition: "I can move"
      }
    }
  ]);

  const assessmentHarness = createGuideHarness("preparation");
  const updatedAssessment = assessmentHarness.guide.applyAction({
    type: "update_assessment",
    sessionId: "ses_test",
    workflowState: "preparation",
    assessment: {
      image: "image draft",
      disturbance: 4
    }
  });

  assert.equal(updatedAssessment.accepted, true);
  assert.deepEqual(assessmentHarness.calls, [
    {
      type: "assessment",
      sessionId: "ses_test",
      assessment: {
        negativeCognition: "old negative",
        positiveCognition: "old positive",
        image: "image draft",
        disturbance: 4
      }
    }
  ]);

  const flowHarness = createGuideHarness("interjection");
  const advanced = flowHarness.guide.applyAction({
    type: "advance_session_flow",
    sessionId: "ses_test",
    workflowState: "interjection",
    action: "continue_stimulation"
  });

  assert.equal(advanced.accepted, true);
  assert.deepEqual(advanced.workflow, { state: "stimulation", activeSessionId: "ses_test" });
  assert.deepEqual(flowHarness.calls, [
    {
      type: "advance",
      action: "continue_stimulation",
      sessionId: "ses_test"
    }
  ]);

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

test("guide service returns structured advisory agent responses without mutating", async () => {
  const { guide, calls } = createGuideHarness("stimulation", {
    respond: async (context) => {
      assert.equal(context.message, "log this set");
      assert.equal(context.workflow.state, "stimulation");
      assert.equal(context.view.mode, "session");
      return {
        messages: ["I can propose logging this set."],
        proposals: [
          {
            type: "log_stimulation_set",
            sessionId: "ses_test",
            workflowState: "stimulation",
            cycleCount: 24,
            observation: "log this set"
          }
        ]
      };
    }
  });

  const response = await guide.respondToMessage({ activeSessionId: "ses_test", message: "log this set" });
  assert.deepEqual(response.messages, ["I can propose logging this set."]);
  assert.equal(response.proposals.length, 1);
  assert.deepEqual(calls, []);
});

test("scripted guide sidecar returns structured advisory proposals", async (t) => {
  const sidecar = new AgentSidecar(
    {
      command: process.execPath,
      args: [path.join(repoRoot, "agent/scripted-guide-sidecar.mjs")],
      startupTimeoutMs: 1000,
      shutdownTimeoutMs: 1000
    },
    undefined,
    (child) => new JsonLineAgentTransport(child.stdout, child.stdin)
  );
  t.after(() => sidecar.stop());

  const client = new GuideAgentSidecarClient(sidecar);
  const response = await client.respond({
    message: "done with this set",
    workflow: { state: "stimulation", activeSessionId: "ses_test" },
    view: {
      mode: "session",
      targetCount: 1,
      messages: [],
      activeSession: {
        sessionId: "ses_test",
        targetId: "tar_test",
        targetDescription: "Test target",
        workflowState: "stimulation",
        stimulationSetCount: 0
      }
    }
  });

  assert.equal(response.messages.length, 1);
  assert.deepEqual(response.proposals, [
    {
      type: "log_stimulation_set",
      sessionId: "ses_test",
      workflowState: "stimulation",
      cycleCount: 24,
      observation: "done with this set",
      disturbance: undefined
    }
  ]);
});

function createGuideHarness(state, agent) {
  const target = { id: "tar_test", description: "Test target" };
  const calls = [];
  let workflow = state === "idle" || state === "target_selection" ? { state } : { state, activeSessionId: "ses_test" };
  const workflowRules = new SessionWorkflowMachine();

  const guide = new GuideService(
    {
      addTarget: (draft) => {
        calls.push({ type: "target", draft });
        return { id: "tar_new", ...draft };
      },
      listCurrentTargets: () => [target],
      listAllTargets: () => [target]
    },
    {
      listSessions: () => [
        {
          id: "ses_test",
          targetId: target.id,
          assessment: {
            negativeCognition: "old negative",
            positiveCognition: "old positive"
          },
          stimulationSets: [],
          endedAt: undefined
        }
      ],
      updateAssessment: (sessionId, assessment) => {
        calls.push({ type: "assessment", sessionId, assessment });
        return { id: sessionId, assessment };
      },
      advanceSessionFlow: (action, sessionId) => {
        calls.push({ type: "advance", action, sessionId });
        const nextState = workflowRules.nextSessionFlowState(workflow.state, action);
        workflow = nextState === "idle" || nextState === "target_selection" ? { state: nextState } : { state: nextState, activeSessionId: sessionId };
        return workflow;
      },
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
    },
    agent
  );

  return { guide, calls };
}
