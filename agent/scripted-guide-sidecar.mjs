import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin });
let targetIntake;

lines.on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }

  if (request.type !== "guide:message") {
    respond(request.id, { ok: false, error: `Unsupported request type: ${request.type}` });
    return;
  }

  respond(request.id, { ok: true, payload: guideMessageResponse(request.payload) });
});

lines.on("close", () => process.exit(0));

function respond(id, response) {
  process.stdout.write(`${JSON.stringify({ id, ...response })}\n`);
}

function guideMessageResponse(payload) {
  const message = String(payload?.message ?? "");
  const workflow = payload?.workflow;
  const state = workflow?.state;
  const sessionId = workflow?.activeSessionId;
  const normalized = message.toLowerCase();

  if (!sessionId) {
    const targetIntakeResponse = guideTargetIntakeResponse(message, state);
    if (targetIntakeResponse) {
      return targetIntakeResponse;
    }

    if (state === "target_selection") {
      return {
        messages: ["What memory, image, or situation feels useful to focus on right now? A few words are enough."],
        proposals: []
      };
    }

    targetIntake = undefined;
    return {
      messages: ["What memory, image, or situation feels useful to focus on right now? A few words are enough."],
      proposals: []
    };
  }

  targetIntake = undefined;

  if (state === "preparation" && /\b(assessment|image|sud|disturbance|cognition)\b/.test(normalized)) {
    return {
      messages: ["I can draft assessment updates. Review them before applying."],
      proposals: [
        {
          type: "update_assessment",
          sessionId,
          workflowState: state,
          assessment: {
            image: message
          }
        }
      ]
    };
  }

  if (state === "stimulation" && /\b(done|log|pause|set|stop)\b/.test(normalized)) {
    return {
      messages: ["I can propose logging this stimulation set. Review it before applying."],
      proposals: [
        {
          type: "log_stimulation_set",
          sessionId,
          workflowState: state,
          cycleCount: 24,
          observation: message
        }
      ]
    };
  }

  if (state === "interjection" && /\b(continue|another|resume)\b/.test(normalized)) {
    return {
      messages: ["I can propose continuing stimulation. Review it before applying."],
      proposals: [
        {
          type: "advance_session_flow",
          sessionId,
          workflowState: state,
          action: "continue_stimulation"
        }
      ]
    };
  }

  if (state === "closure" && /\b(review|summary|done|finish)\b/.test(normalized)) {
    return {
      messages: ["I can propose moving to review. Review it before applying."],
      proposals: [
        {
          type: "advance_session_flow",
          sessionId,
          workflowState: state,
          action: "request_review"
        }
      ]
    };
  }

  if (state === "review" && /\b(end|finish|complete|done)\b/.test(normalized)) {
    return {
      messages: ["I can propose ending the session with your current review notes."],
      proposals: [
        {
          type: "end_session",
          sessionId,
          workflowState: state,
          notes: message
        }
      ]
    };
  }

  return {
    messages: ["I noted that. Continue with the current session controls when you are ready."],
    proposals: []
  };
}

function guideTargetIntakeResponse(message, state) {
  const text = message.trim();
  if (state !== "target_selection" || !text) return undefined;

  const isUnclearTargetReply = /\b(help|not sure|unsure|don't know|do not know)\b/i.test(text);
  if (!targetIntake && isUnclearTargetReply) {
    return {
      messages: ["What memory, image, or situation feels useful to focus on right now? A few words are enough."],
      proposals: []
    };
  }

  if (!targetIntake) {
    targetIntake = { description: text };
    return {
      messages: ["How does that make you feel right now?"],
      proposals: []
    };
  }

  if (!targetIntake.emotions) {
    targetIntake = { ...targetIntake, emotions: text };
    return {
      messages: ["What subjective disturbance score would you give that feeling from 0 to 10?"],
      proposals: []
    };
  }

  if (targetIntake.disturbance === undefined) {
    const disturbance = disturbanceScoreFrom(text);
    if (disturbance === undefined) {
      return {
        messages: ["Please give a subjective disturbance score from 0 to 10."],
        proposals: []
      };
    }

    targetIntake = { ...targetIntake, disturbance };
    return {
      messages: ["What negative cognition goes with it?"],
      proposals: []
    };
  }

  if (!targetIntake.negativeCognition) {
    targetIntake = { ...targetIntake, negativeCognition: text };
    return {
      messages: ["What positive cognition would you rather hold with this target?"],
      proposals: []
    };
  }

  targetIntake = undefined;

  return {
    messages: [],
    proposals: []
  };
}

function disturbanceScoreFrom(text) {
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
