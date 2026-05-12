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
    return {
      messages: ["I can help once a session is active. Open Targets to choose what to work on."],
      proposals: []
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
