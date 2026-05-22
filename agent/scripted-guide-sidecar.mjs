import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin });

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
    const isUnclearTargetReply = /\b(help|not sure|unsure|don't know|do not know)\b/.test(normalized);
    if (state === "target_selection" && message.trim() && !isUnclearTargetReply) {
      return {
        messages: ["I can turn that into a target draft. Review it before saving."],
        proposals: [
          {
            type: "create_target_draft",
            workflowState: state,
            description: message
          }
        ]
      };
    }

    return {
      messages: ["What memory, image, or situation feels useful to focus on right now? A few words are enough."],
      proposals: []
    };
  }

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
