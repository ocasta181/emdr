# Feature: Animated App Shell

## Status

Proposed

## Goal

Turn the current form-oriented desktop MVP into a chat-first animated local companion app while keeping the existing local-first privacy model and domain logic.

The first target experience is a single calm illustrated room. The user interacts with the guide character and room objects instead of navigating a conventional dashboard. Bilateral stimulation should run as a first-class scene element, not as a basic UI widget.

## Product Direction

The app should feel like a private guided practice space:

- a single illustrated room or outdoor overlook;
- a calm animated guide character;
- clickable room objects for targets, session history, settings, and exports;
- a chat-first session flow;
- optional structured edits when the user wants to correct what the agent wrote down;
- bilateral stimulation rendered across the scene with adjustable speed, color, size, and motion path.

The environment does not need to become a complex game world. The priority is atmosphere, clarity, reliable session flow, and privacy.

## Recommended Stack

Use the current Electron + React foundation and add PixiJS for the animated scene.

Recommended layering:

```text
Electron main process
  local filesystem
  encrypted persistence
  local agent process
  optional camera/OpenCV process

React renderer
  app layout
  chat UI
  panels and modals
  accessibility and keyboard flow

PixiJS scene
  illustrated room
  character sprite/animation
  room object hit areas
  particles and ambient motion
  bilateral stimulation overlay

Domain core
  targets
  sessions
  settings
  stimulation sets
  app metadata
```

React should own application state and durable UI. PixiJS should own real-time visuals, scene composition, pointer hit testing for room objects, and animation.

## Why PixiJS

PixiJS is a better fit than plain CSS for the room because it provides a WebGL-backed 2D scene graph, sprites, containers, filters, ticker-based animation, and pointer events. It is much lighter than introducing a full game engine while still giving the app a game-like rendering layer.

Electron can support this target comfortably. Character animation should use a deliberately choppy 12 FPS sprite cadence, while PixiJS still renders scene effects and stimulation movement at normal ticker speed with graceful degradation when the local agent or camera process is busy.

## Scene Responsibilities

The PixiJS scene should handle:

- loading room and character assets;
- rendering background, midground, foreground, and UI-adjacent scene elements;
- ambient motion such as cloth, lanterns, dust, clouds, fireflies, or mist;
- clickable room object hit areas;
- guide character idle, speaking, thinking, book, and session states;
- bilateral stimulation object movement;
- visual focus states for selected room objects;
- resize behavior for windowed and fullscreen modes.

The PixiJS scene should not own:

- clinical workflow decisions;
- persistence;
- chat transcript storage;
- target/session mutation;
- LLM prompting;
- settings business logic.

## React Responsibilities

React should handle:

- chat transcript;
- agent messages and user replies;
- room object panels;
- settings controls;
- target/session history views;
- consent and privacy dialogs;
- editable structured notes;
- app-level navigation state;
- accessibility fallbacks;
- error states.

For maintainability, React should treat the PixiJS scene as a controlled child component:

```ts
type RoomSceneProps = {
  mode: "idle" | "chat" | "session" | "stimulation" | "review";
  guideAnimation: GuideAnimationIntent;
  stimulation?: {
    running: boolean;
    speed: number;
    color: string;
    size: number;
    path: "horizontal" | "arc" | "pendulum";
  };
  highlightedObject?: "targets" | "history" | "settings" | "export";
  onObjectSelected: (objectId: RoomObjectId) => void;
};
```

## Room Objects

The initial room can expose four major interaction zones:

- **Guide**: opens the main chat and starts or resumes the current guided flow.
- **Target book**: a large burgundy leather-bound book used for target selection, target review, and target editing.
- **Journal/archive object**: opens session history and summaries.
- **Lantern/settings object**: opens stimulation, privacy, model, camera, and export settings.

These can be represented as PixiJS hit areas, with React panels opening over or beside the scene.

## Guide And Target Book

Target access should be represented through a book interaction, not through unrelated floating panels alone. The book has two render modes:

- independent target book sprite at rest, visible and clickable when the guide is not holding it;
- book included with the guide animation while the guide possesses it.

The held book must not be rendered as a separate runtime overlay. While possessed, every visible book state belongs inside the selected guide animation clip asset.

The guide-book animation contract is defined in `src/animation/guideAnimationModel.ts`. Guide state derives a semantic `GuideAnimationIntent`; the guide animation module maps that intent through a book-state graph and then into sprite-sheet action clips. Room state, including stimulation, stays separate from guide animation state.

Book states:

- `on_ground`;
- `in_hand_closed`;
- `in_hand_open`.

Guide actions:

- `pick_up_book`;
- `put_down_book`;
- `open_book`;
- `close_book`;
- `flip_through_book`;
- `write_in_book`;
- `speak`;
- `think`.

Possession handoff rules:

- At the beginning of `pick_up_book`, the guide sprite does not include the book and the independent book sprite is visible.
- During `pick_up_book`, the independent book sprite is hidden once the guide takes possession; from that point, the book is part of the guide animation.
- During all held-book states, the independent book sprite remains hidden.
- During `put_down_book`, the book remains part of the guide animation until the guide releases it.
- After release, the independent book sprite becomes visible at the resting location while the guide returns hands to center without the book.

Target access mapping:

- reading targets: path to `in_hand_open`;
- browsing target versions or target history: path to `flip_through_book`;
- creating or editing targets: path to `write_in_book`;
- leaving target work: path to `on_ground`.

Domain states should not reference art assets directly. Workflow state maps to animation intent, and the PixiJS scene maps that intent through graph traversal to sprites and animation clips.

## Bilateral Stimulation

Bilateral stimulation should be implemented as a deterministic animation system, not as an LLM-controlled behavior.

The stimulation renderer should support:

- horizontal left-right movement;
- speed control;
- color control;
- object size control;
- optional shape/theme variants;
- pause/resume;
- cycle counting;
- reduced-motion mode;
- keyboard shortcuts;
- user-defined safe bounds so the object does not pass under text.

The stimulation state should be serializable:

```ts
type StimulationRuntimeState = {
  running: boolean;
  startedAt?: string;
  elapsedMs: number;
  cycleCount: number;
  speed: number;
  color: string;
  size: "small" | "medium" | "large";
  path: "horizontal" | "arc" | "pendulum";
};
```

The saved session record should store stimulation set summaries, not every animation frame.

## Asset Pipeline

Start with a small asset set:

- one background image;
- one foreground overlay;
- guide character sprite sheet with semantic guide-action clips;
- stimulation object variants;
- object highlight glows;
- panel frame textures only if needed.

Prefer atlased PNG/WebP sprites or Rive animations for character motion. The current guide prototype uses a single 154-cell PNG sheet with the standalone book in the final cell.

Suggested first directory shape:

```text
src/animation/
  RoomScene.tsx
  pixi/
    createRoomStage.ts
    guideCharacter.ts
    stimulation.ts
    roomObjects.ts
    assets.ts
  types.ts

assets/room/
  hilltop/
    background.webp
    foreground.webp
    guide.json
    guide.png
```

## Performance Requirements

The animated app shell should:

- target 60 FPS for the room scene;
- remain acceptable at 30 FPS;
- never block chat input while animation is running;
- keep local LLM inference outside the renderer thread;
- keep OpenCV processing outside the renderer thread;
- pause or reduce scene animation when the window is hidden;
- use `requestAnimationFrame` through PixiJS ticker rather than React state updates for per-frame motion.

React state should not be updated on every animation frame. PixiJS runtime state can update internally and emit coarse events such as cycle count changes.

## Accessibility and Safety

The animated app must include:

- reduced-motion mode;
- stimulation pause control that is always visible during sessions;
- keyboard-only access to chat and critical controls;
- clear escape route from a session;
- brightness and contrast controls;
- no required camera use;
- no hidden telemetry;
- local-only session data.

## Implementation Plan

1. Add PixiJS and create a minimal `RoomScene` React component.
2. Render a static room background that resizes cleanly.
3. Add clickable room object hit areas that open existing React views.
4. Move the current visual bilateral stimulation into the PixiJS scene.
5. Add guide character states driven by app state.
6. Replace form-first session entry with chat-first prompts.
7. Add reduced-motion and low-power settings.
8. Add visual regression checks for desktop window sizes.
9. Add smoke tests for scene mount, object selection, stimulation start/stop, and resize.

## Open Questions

- Should the guide character use sprite sheets, Rive, Spine, or simple layered PNG animation?
- Should the scene use one room for all app states or subtle room variants per flow?
- Should stimulation always overlay the full scene, or only a dedicated session composition?
- Should the current dashboard continue to exist as a fallback/debug view?
- What minimum hardware should the app support?
