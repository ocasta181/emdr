# Feature: State Graph Simplification

## Status

In progress

## Goal

Simplify workflow and animation code by treating app behavior as explicit directed graphs: nodes are states, edges are actions. Avoid parallel vocabularies, duplicated state tables, and UI decision trees that independently redefine the same flow.

This note captures the intended cleanup direction before implementation.

## Coverage

This proposal accounts for the highest-value simplifications identified in the codebase assessment:

- [x] replace the split session flow/tool vocabulary with one state/action graph;
- [ ] make session UI rendering depend on that graph instead of redefining state flow in JSX;
- [ ] split animated room stimulation state from panel state so settings can open while stimulation continues;
- [ ] replace room-object `if`/`switch` branches with object registries;
- [x] model target versions as parent-linked persisted records;
- [ ] add derived lineage indexes for target version history, rollback, and diff views;
- [ ] move guide sprite action clip metadata onto the existing guide animation graph.

Some wording differs from the original assessment because the follow-up design constraints are stricter: there is no separate agent-tool concept, and domain state graphs must not import or define UI components.

## Vocabulary

Use only two domain concepts for workflow control:

- **State**: the current position in a workflow.
- **Action**: an edge that may move the workflow from one state to another.

Do not keep a separate "agent tool" vocabulary. A future agent requests the same actions the app already understands, and deterministic code validates whether that action is available from the current state.

Preferred action names should be plain product actions:

- `update_assessment`
- `close_session`
- `request_review`
- existing session actions where they are already clear

Avoid introducing unclear clinical or internal terms into the action vocabulary. If an action is not meaningful to the user or to deterministic workflow validation, it probably should not be an action.

## Session State Graph

The session flow should be represented as a directed graph inspired by the guide animation graph. Each graph node is a session state. Each outgoing edge is an action with a target state.

The graph should be the single source of truth for valid state movement:

```ts
type SessionStateNode = {
  state: SessionFlowState;
  edges: SessionStateAction[];
};

type SessionStateAction = {
  action: SessionFlowAction;
  to: SessionFlowState;
};
```

The current `sessionFlowDefinitions` structure is already close to this, but the cleanup should remove parallel action/tool tables and make all validation derive from the graph.

Expected graph-derived operations:

- [x] `availableActions(state)`
- [x] `canApplyAction(state, action)`
- [x] `nextState(state, action)`
- [ ] future agent action validation

The session graph should not import React, PixiJS, or presentation components.

Labels, descriptions, button copy, and component choices are UI concerns. They may be keyed by state or action in the UI layer, but they must not define valid states or valid actions.

## UI Dependency Direction

State and UI must stay separate. The UI depends on state; state does not depend on UI.

The session UI should not define its own state machine through JSX conditionals. It should read the current state and use small UI-layer registries to decide how to render that state.

Acceptable UI-layer structures:

```ts
const sessionStateViews: Partial<Record<SessionFlowState, SessionStateView>> = {
  preparation: { component: AssessmentStep },
  stimulation: { component: StimulationStep },
  closure: { component: CloseStep }
};

const sessionActionLabels: Record<SessionFlowAction, string> = {
  update_assessment: "Save assessment",
  close_session: "Close session",
  request_review: "Review"
};
```

These mappings describe rendering and copy only. They must not define which actions are valid; valid actions come from the graph.

The rendered step/progress UI should also derive from graph states. A UI-only order may decide how known states are displayed, but it must not create states, actions, or allowed movement. It should not duplicate flow logic.

Event handlers should dispatch actions from the graph:

```ts
const actions = availableActions(flowState);
```

Buttons can filter or label those actions for presentation, but the graph remains the only authority for whether an action is possible.

## Animated Room State

Avoid encoding independent facts as cross-product states. `stimulation_settings` combines "stimulation is running" with "settings are open"; those should be separate facts.

Use orthogonal state for the animated room:

```ts
type AnimatedRoomState = {
  panel: "chat" | "targets" | "history" | "settings" | null;
  stimulation: "idle" | "running";
};
```

Opening stimulation settings should not pause stimulation. The user should be able to adjust settings while stimulation continues so they can see the effect immediately.

This means:

- `start_stimulation` sets `stimulation: "running"`;
- opening `settings` changes only `panel`;
- `pause_stimulation` sets `stimulation: "idle"`;
- panel state and stimulation state are independent unless a specific action intentionally changes both.

## Room Object Registry

Room object behavior should move from conditional branches to data-driven registries.

React can map room object ids to actions:

```ts
const roomObjectActions: Record<RoomObjectId, () => void> = {
  guide: openGuide,
  targets: openTargets,
  history: openHistory,
  settings: openSettings
};
```

PixiJS can map room object ids to scene definitions and hotspot graphics:

```ts
type RoomObjectDefinition = {
  id: RoomObjectId;
  label?: string;
  drawHotspot: (layout: RoomLayout) => void;
  visible?: (runtime: RoomRuntime) => boolean;
};
```

Adding a new room object should primarily mean adding a definition, not editing several `if` or `switch` branches.

## Target Version Model

Targets are versioned records. The persisted model should not need both a stored root id and a parent id.

Use parent links only:

```ts
type Target = {
  id: string;
  parentId?: string;
  isCurrent: boolean;
  // target fields...
};
```

Rules:

- the original version has no parent;
- every later version has `parentId` pointing to the immediate previous version;
- `isCurrent` is independent and marks the latest version;
- there should be exactly one current version for a logical target lineage.

The root of a target lineage can be found by following parent links until a target has no parent. Child versions can be found through an index built from parent ids.

Useful in-memory index:

```ts
type TargetVersionIndex = {
  byId: Map<string, Target>;
  childrenByParentId: Map<string, Target[]>;
  lineageRootById: Map<string, string>;
  versionsByLineageRootId: Map<string, Target[]>;
  currentByLineageRootId: Map<string, Target>;
};
```

If version history, rollback, or diff views are added, the UI should use this index instead of repeatedly filtering the flat target array.

This keeps the persisted model minimal while still giving the application the tree-shaped access pattern it needs. The root id is derived by walking parent links; it is not stored on each row.

Implementation required a SQLite migration and domain type updates:

- [x] drop `root_target_id`;
- [x] rename `parent_target_id` to `parent_id`;
- [x] enforce parent integrity with a self-reference where practical;
- [ ] preserve one current target per lineage through comprehensive service rules and, if feasible, database constraints.

## Guide Animation Graph

The guide animation model is already the best example in the codebase: a graph of book states and action edges with path planning.

The next simplification is to attach clip metadata to graph edges so the graph and sprite sheet cannot drift.

```ts
type GuideAnimationEdge = {
  action: GuideAction;
  to: BookState;
  clip: {
    start: number;
    count: number;
    reverse?: boolean;
  };
};
```

With clip metadata on edges:

- if an action exists, its animation clip is defined at the same site;
- sprite-sheet lookup becomes a mechanical conversion from edge metadata to textures;
- missing clip errors move closer to graph definition time.

Idle clips and independent book-at-rest frames can remain sheet-level metadata because they are not action edges.

## Implementation Order

- [x] Unify session actions and remove separate agent tool vocabulary.
- [x] Make the session graph the only source of valid state movement.
- [ ] Refactor session UI to render from state and graph-derived available actions.
- [ ] Split animated room panel state from stimulation state.
- [ ] Convert room object selection and hotspots to registries.
- [x] Simplify target version persistence to parent links plus `isCurrent`.
- [ ] Move guide action clip metadata onto graph edges.

Each step should be committed independently because several affect persisted data and public domain vocabulary.
