# Feature: Local Agent Guide

## Status

Proposed

## Goal

Introduce a local-only guide agent that helps the user move through EMDR-related practice flows without sending targets, sessions, camera data, transcripts, or model inputs to third-party services.

The agent should act as a structured proctor and reflective assistant. It should not present itself as a therapist, diagnose the user, make medical claims, or independently decide clinical treatment.

## Product Role

The guide agent should:

- welcome the user into the room;
- help select or create a target through conversation;
- ask structured session prompts;
- summarize what the user said into editable notes;
- start, pause, and stop bilateral stimulation through app actions;
- check whether the user wants to continue, pause, ground, or close;
- produce a session summary for user review;
- maintain local memory only with explicit consent.

The user should be able to edit any structured record the agent creates before it becomes durable session data.

## Privacy Requirements

The agent system must be local-first:

- no remote LLM API by default;
- no Steam Cloud for session data;
- no Steam achievements;
- no third-party analytics;
- no remote transcript storage;
- no camera frames stored by default;
- encrypted local database before any public release;
- explicit user consent before enabling local long-term memory;
- explicit user consent before enabling camera-derived signals.

Steam may still know that the user owns, installs, launches, or plays the app. The app should not put clinical/session data into Steam APIs or Steam-managed cloud paths.

## Recommended Runtime

Use a bundled local inference sidecar rather than relying on the user to install Ollama or another external runtime.

Recommended first implementation:

```text
Electron main process
  starts/stops local LLM sidecar
  sends prompts over localhost or stdio
  validates structured action requests
  stores approved records in encrypted SQLite

llama.cpp sidecar
  runs a quantized GGUF model
  exposes a local completion/chat endpoint or stdio protocol

Renderer
  displays chat
  displays editable extracted notes
  sends user actions to Electron main
```

Ollama is useful for development, but it is less attractive as the shipped runtime because it adds another installed service and model-management surface. A `llama.cpp` sidecar gives more control over packaging, ports, model files, startup, and privacy guarantees.

Decision: the release build should ship its own `llama.cpp` runtime and one default model. The user should not need to install Ollama, Python, Homebrew, Hugging Face tooling, or a separate local AI app.

The sidecar should communicate over stdio if practical. If an HTTP server is used, it must bind only to `127.0.0.1`, use a random available port, and be started/stopped by the Electron main process.

## Model Recommendation

Use a small instruction-tuned open-weights model in the 3B-4B range for the first production prototype.

Current recommended default: **Qwen3-4B-Instruct-2507**, quantized to GGUF for `llama.cpp`.

Reasons:

- small enough for local CPU/GPU inference on consumer machines;
- strong enough for constrained chat, summarization, and structured extraction;
- does not need frontier-model reasoning for this app's limited action space;
- available as an instruction-tuned model on Hugging Face;
- released under Apache 2.0 according to the model repository;
- suitable for an action-driven architecture where deterministic app code owns the clinical workflow.

Fallback candidates:

- **Llama 3.2 3B Instruct** for a compact Meta model;
- **Gemma 3 4B IT** if its license and runtime behavior fit distribution needs;
- a larger 7B-8B model only if local latency and memory are acceptable.

References to review before locking the model:

- Qwen3-4B-Instruct-2507 model card: https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- Llama 3.2 3B Instruct model card: https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
- Gemma 3 model overview: https://blog.google/technology/developers/gemma-3/
- Kimi K2 repository, useful as a non-v1 comparison point: https://github.com/MoonshotAI/Kimi-K2
- llama.cpp project: https://github.com/ggml-org/llama.cpp
- Ollama documentation, useful for development comparison: https://docs.ollama.com/

The final model choice must include a license review before Steam distribution.

Decision: use one default local model in v1. Do not expose a general model picker in the primary UI. Model choice is a support and safety surface, not only a power-user feature.

Decision: target a 4-bit quantized 4B-class model for the first release. If Qwen3-4B-Instruct-2507 fails latency, quality, or license review, fall back to Llama 3.2 3B Instruct before moving up to a larger 7B-8B model. The app's action space is limited enough that reliability, packaging, and predictable tool output matter more than broad world knowledge.

Kimi-family models can be revisited only if there is a small local model in the same practical range. Kimi K2-class models are not a fit for this product runtime because they are frontier-scale MoE models with far more active parameters than a consumer local app should require.

Initial minimum hardware target:

- Apple Silicon Mac or modern x64 CPU with AVX2 support;
- 16 GB RAM required/recommended for the agent build;
- 8 GB RAM not a v1 target unless testing shows the default model is still reliable;
- GPU acceleration optional;
- no network required after install.

If the default model cannot run acceptably on 8 GB machines, ship the app with a clear minimum requirement rather than silently degrading to unsafe or incoherent guidance.

## Packaging Strategy

The app should package three separate layers:

```text
Application bundle
  Electron app
  React/PixiJS renderer
  domain logic
  database migrations

Inference runtime
  llama.cpp binary for the target platform
  model metadata
  startup/health-check wrapper

Model weights
  quantized GGUF file
  checksum
  license notice
  model card summary
```

Packaging options considered:

1. **Bundle the model in the main app depot.**
   - Simplest user experience.
   - Larger download.
   - Requires clear model license compatibility.

2. **Use a separate required model depot.**
   - Keeps app builds smaller.
   - Allows future model upgrades.
   - Still local and Steam-distributed.

3. **Ask the user to import/download a model outside Steam.**
   - Maximum flexibility.
   - Worst first-run experience.
   - Harder to support.

Decision: the model is mandatory for the v1 product vision. The app can have graceful error handling when the model fails to start, but the intended product includes the local guide agent by default.

The app should verify the model file checksum before use and expose the active model name/version in privacy settings.

Decision: model weights should be distributed by the app/Steam installer, not pulled from Hugging Face or another remote service on first run. Steam will host the model file as application content, but the model will run locally and will not upload user session data.

Preferred packaging shape for Steam:

- main app depot includes Electron, React/PixiJS assets, domain logic, and migrations;
- platform runtime depots include the correct `llama.cpp` binary for each supported OS/architecture;
- required model depot includes the approved quantized GGUF model, checksum, model card summary, and license notices;
- all required depots install by default for the standard app;
- future model upgrades are shipped as app updates, not as runtime cloud downloads.

This preserves the "works offline after install" promise and avoids making users fetch a model from a third party.

## Builds and Storage

Steam separates builds, depots, and packages:

- a **depot** is a platform/content bucket, such as Windows app files, macOS app files, native inference binaries, or shared model weights;
- a **build** is a specific uploaded version of one or more depots;
- a **package** controls which depots a user receives when they install the app.

For a first Steam release that supports Windows and macOS, expect this content layout:

```text
Steam app
  Depot: windows-x64-app
    Electron app
    React/PixiJS assets
    Windows llama.cpp sidecar

  Depot: macos-universal-app
    Electron app
    React/PixiJS assets
    macOS universal or per-arch llama.cpp sidecar

  Depot: shared-local-model
    default quantized GGUF model
    checksum
    model card summary
    license notices
```

If the first release is macOS-only, only the macOS app depot and shared model depot are required. If Windows is a Steam requirement for the product, Windows x64 should be treated as the primary build target.

Do not commit the GGUF model file to normal git history. The repository should store:

- packaging scripts;
- model manifest;
- expected checksum;
- license notices;
- instructions for placing the release model artifact.

The actual model artifact should live in release storage used by the build pipeline, then be uploaded to Steam as depot content. Local developer machines can keep the model under an ignored path such as:

```text
vendor/models/
```

Steam stores uploaded depot content on Steam's content servers. The app stores user data separately in the user's local app data directory, encrypted before release. The model file is application content; user targets, transcripts, sessions, camera data, and local memory are not Steam depot content and should not be placed in Steam Cloud paths.

## Agent Architecture

The model should not be allowed to directly mutate app state. It should propose structured actions, and deterministic code should validate them.

```text
User message
  -> conversation manager
  -> prompt builder
  -> local LLM
  -> structured response parser
  -> policy/action validator
  -> app state transition
  -> user-visible response
```

The agent can request app actions. Action request types should use `SessionFlowAction` names rather than an agent-only tool vocabulary:

```ts
type AgentActionRequest =
  | { action: "create_target_draft"; description: string; negativeCognition?: string; positiveCognition?: string }
  | { action: "select_target"; targetId: string }
  | { action: "update_assessment"; fields: Partial<Assessment> }
  | { action: "start_stimulation"; speed?: number; color?: string }
  | { action: "pause_stimulation" }
  | { action: "log_stimulation_set"; observation: string; disturbance?: number }
  | { action: "request_grounding" }
  | { action: "begin_closure"; finalDisturbance?: number; notes?: string }
  | { action: "request_review"; recordType: "target" | "assessment" | "session_summary" }
  | { action: "close_session" };
```

Every action request should be checked against:

- current app mode;
- active session state;
- required user consent;
- required fields;
- safety rules;
- whether the user must review before persistence.

## Decision Tree

The first version can use a deterministic session state machine with LLM-authored wording inside each state.

```text
Idle
  If user wants to start:
    ask whether to use an existing target or create a new one
  If user wants history:
    open session history
  If user wants settings:
    open settings

Target selection
  If existing target is chosen:
    confirm target
  If new target is described:
    extract target draft
    ask user to review/edit
  If user is unsure:
    ask grounding/context questions without forcing detail

Preparation
  Ask for image or scene, negative cognition, positive cognition, body sensation, and disturbance
  Extract structured assessment
  Ask user to review/edit
  Offer start, pause, or stop

Stimulation
  Start deterministic bilateral stimulation
  Monitor cycles and elapsed time
  Let user pause at any time
  After a set, ask what they notice
  Extract observation and optional disturbance
  Ask whether to continue, pause, ground, or close

Interjection
  If user expresses distress, confusion, or desire to stop:
    pause stimulation
    offer grounding
    offer session close
  If camera signals are enabled and simple fatigue/visibility signal triggers:
    suggest a pause without diagnosis

Closure
  Ask for final disturbance and notes
  Summarize session
  Ask user to review/edit
  Save only after confirmation

Post-session
  Offer export, history view, or return to room
```

The LLM should choose from constrained wording patterns, summarize text, and request actions. The app should choose which states and actions are allowed.

## Action Permission Matrix

The app should enforce action permissions by state:

```text
Idle
  Allowed: start_session, select_target
  Blocked: start_stimulation, log_stimulation_set, close_session

Target selection
  Allowed: create_target_draft, select_target, return_to_idle
  Blocked: start_stimulation, log_stimulation_set, close_session

Preparation
  Allowed: update_assessment, approve_assessment, request_grounding, begin_closure
  Blocked until review: start_stimulation

Stimulation
  Allowed: start_stimulation, pause_stimulation, log_stimulation_set, request_grounding, begin_closure
  Allowed after explicit user confirmation: start_stimulation
  Blocked: create_target_draft, select_target

Interjection
  Allowed: continue_stimulation, request_grounding, begin_closure
  Blocked: create_target_draft, select_target

Closure
  Allowed: request_review, continue_stimulation, request_grounding
  Blocked: create_target_draft, select_target

Review
  Allowed: close_session, begin_closure
  Blocked: durable saves until user approves the draft
```

The model may ask for an action, but the app is the authority. Invalid action requests should be rejected, logged locally for debugging, and followed by a safe clarification message.

Agent-requested actions are function calls, not broad autonomous text behavior. The renderer may display the model's user-facing message, but any state mutation must come through validated action requests.

The guide should feel like a minimal proctor with a small amount of character. Personality should come from a curated response library and scene animation states, not from unconstrained model improvisation.

## Basic System Prompt

```text
You are the local guide for a private EMDR-practice companion app.

You are not a therapist, doctor, crisis service, or medical device. Do not diagnose, make treatment claims, or tell the user that a clinical outcome is guaranteed. Guide the user through the app's structured practice flow, ask concise questions, and help turn the user's words into editable notes.

Privacy is central. Do not suggest cloud sync, external sharing, telemetry, public achievements, or third-party services. Assume all user data should remain local unless the user explicitly exports it.

Use a calm, direct, non-performative tone. Do not pressure the user to describe more than they want. The user can pause, stop, ground, or edit records at any time.

Only use actions that are allowed by the current app state. When creating or updating durable records, produce a draft and ask the user to review it before saving.

If the user expresses immediate danger, intent to self-harm, intent to harm someone else, medical emergency, or inability to stay safe, stop the practice flow and encourage them to contact local emergency services or a trusted nearby person. Do not continue bilateral stimulation during a crisis.

Return responses in this structure:

{
  "message": "Short user-facing reply.",
  "intent": "idle | choose_target | prepare_session | start_stimulation | reflect_after_set | close_session | grounding | history | settings | crisis_or_stop",
  "draft": {
    "target": null,
    "assessment": null,
    "setObservation": null,
    "sessionSummary": null
  },
  "actionRequest": null
}
```

The crisis paragraph is a development placeholder. The released app should use fixed, deterministic crisis copy outside the model prompt so it cannot drift between generations.

Initial fixed crisis copy:

```text
This app is not emergency support. If you might hurt yourself or someone else, or you cannot stay safe, stop this session now and contact local emergency services or a trusted person nearby. I can pause here.
```

The app should display that copy from deterministic code, pause stimulation, and avoid asking the model to continue the session flow.

## Prompt Inputs

Each model call should include only the minimum local context needed:

```ts
type AgentPromptContext = {
  appState: SessionFlowState;
  activeTargetSummary?: string;
  activeAssessmentDraft?: Partial<Assessment>;
  recentMessages: ChatMessage[];
  allowedActions: SessionFlowAction[];
  safetyFlags: {
    stimulationRunning: boolean;
    cameraEnabled: boolean;
    memoryEnabled: boolean;
  };
};
```

Do not include full session history unless the user explicitly asks for it or has enabled local memory for that purpose.

## Local Memory

Local memory should be opt-in and scoped:

- no memory by default beyond the current session flow;
- user-approved target/session records are stored as structured data;
- optional summaries can be added to a local retrieval index;
- the user can inspect and delete memory;
- the user can disable memory without losing manually saved session records;
- memory should be encrypted at rest.

Decision: raw chat transcripts are not retained by default after a completed session. During an active session, the transcript can remain in volatile memory and temporary encrypted draft storage so the user can complete the flow. When the session is closed, the app should save only:

- approved target records;
- approved assessment fields;
- approved stimulation set observations;
- approved final notes;
- an approved session summary.

The user may opt into keeping the full raw transcript per session, but that should be off by default and clearly labeled as more sensitive.

## Camera and OpenCV

Camera support should be separate from the core agent. It is not part of the MVP.

The first version that adds camera support should not infer emotional state.

Acceptable first signals:

- face visible / not visible;
- lighting too low;
- user appears to have looked away for a configurable period;
- possible fatigue cue based on simple eye-closure duration.

These signals should produce gentle app events such as:

```ts
type PerceptionEvent =
  | { type: "face_not_visible" }
  | { type: "lighting_low" }
  | { type: "looked_away" }
  | { type: "possible_fatigue" };
```

The app may suggest a pause. It should not label trauma state, emotional state, dissociation, or clinical risk from camera data.

## Implementation Plan

1. Define the deterministic session state machine.
2. Add an agent adapter interface with a fake scripted implementation for tests.
3. Build the chat-first UI using the scripted implementation.
4. Add structured draft review/edit UI for targets, assessments, set observations, and summaries.
5. Add a `llama.cpp` sidecar in development mode.
6. Test Qwen3-4B-Instruct-2507, Llama 3.2 3B Instruct, and Gemma 3 4B IT on target hardware.
7. Add action request validation and JSON schema validation.
8. Add encrypted local storage for chat/session records.
9. Add first-run privacy and model disclosure.
10. Add optional local memory after the core flow is reliable.
11. Defer camera/OpenCV signals until after the MVP.

## Evaluation

The agent should be tested against scripted scenarios:

- create a target from natural language;
- choose an existing target;
- refuse to save without review;
- start/pause stimulation only in allowed states;
- log a stimulation set;
- handle "I want to stop";
- handle distress language by pausing and offering grounding;
- produce concise summaries;
- avoid medical claims;
- avoid cloud/achievement suggestions;
- operate offline.

## Open Questions

- What exact safety and crisis copy should be reviewed by a qualified clinician or legal reviewer before release?
- What release-note language is needed to explain that Steam hosts app/model files but not user session data?
- Which supported platforms are required for the first Steam release: macOS-only, Windows-only, or both?
- Should the macOS build be universal, or should it use separate Apple Silicon and Intel depots?
