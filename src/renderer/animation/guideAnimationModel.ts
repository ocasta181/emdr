import type { StateGraphEdge, StateGraphNode } from "../../../stateGraph.js";

export type BookState = "on_ground" | "in_hand_closed" | "in_hand_open";

export type GuideAction =
  | "pick_up_book"
  | "put_down_book"
  | "open_book"
  | "close_book"
  | "flip_through_book"
  | "write_in_book"
  | "speak"
  | "think";

export type GuideAnimationIntent =
  | { type: "book_state"; bookState: BookState }
  | { type: "action"; action: GuideAction };

export type GuideAnimationEdge = StateGraphEdge<BookState, GuideAction>;

export type GuideAnimationNode = StateGraphNode<BookState, GuideAction, GuideAnimationEdge>;

export type GuideAnimationStep = {
  from: BookState;
  to: BookState;
  action: GuideAction;
};

export type IndependentBookState = "visible" | "hidden";

export const guideAnimationGraph = [
  {
    state: "on_ground",
    edges: [
      { action: "pick_up_book", to: "in_hand_closed" },
      { action: "speak", to: "on_ground" },
      { action: "think", to: "on_ground" }
    ]
  },
  {
    state: "in_hand_closed",
    edges: [
      { action: "put_down_book", to: "on_ground" },
      { action: "open_book", to: "in_hand_open" },
      { action: "speak", to: "in_hand_closed" },
      { action: "think", to: "in_hand_closed" }
    ]
  },
  {
    state: "in_hand_open",
    edges: [
      { action: "close_book", to: "in_hand_closed" },
      { action: "flip_through_book", to: "in_hand_open" },
      { action: "write_in_book", to: "in_hand_open" },
      { action: "speak", to: "in_hand_open" },
      { action: "think", to: "in_hand_open" }
    ]
  }
] satisfies GuideAnimationNode[];

const guideAnimationNodeByState = new Map(guideAnimationGraph.map((node) => [node.state, node]));

export function guideAnimationIntentKey(intent: GuideAnimationIntent): string {
  return intent.type === "action" ? `action:${intent.action}` : `book_state:${intent.bookState}`;
}

export function planGuideAnimation(from: BookState, intent: GuideAnimationIntent): GuideAnimationStep[] {
  return intent.type === "action" ? planPathToAction(from, intent.action) : planPathToBookState(from, intent.bookState);
}

export function planPathToBookState(from: BookState, to: BookState): GuideAnimationStep[] {
  if (from === to) return [];

  const queue: Array<{ state: BookState; path: GuideAnimationStep[] }> = [{ state: from, path: [] }];
  const visited = new Set<BookState>([from]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const node = guideAnimationNodeByState.get(current.state);
    if (!node) {
      throw new Error(`Unknown guide animation book state: ${current.state}`);
    }

    for (const edge of node.edges) {
      if (visited.has(edge.to)) continue;

      const step = { from: current.state, to: edge.to, action: edge.action };
      const path = current.path.concat(step);
      if (edge.to === to) return path;

      visited.add(edge.to);
      queue.push({ state: edge.to, path });
    }
  }

  throw new Error(`No guide animation path from ${from} to ${to}.`);
}

export function planPathToAction(from: BookState, action: GuideAction): GuideAnimationStep[] {
  const candidates = guideAnimationGraph.flatMap((node) =>
    node.edges
      .filter((edge) => edge.action === action)
      .map((edge) => ({
        path: planPathToBookState(from, node.state),
        step: { from: node.state, to: edge.to, action: edge.action }
      }))
  );

  const shortest = candidates.sort((left, right) => left.path.length - right.path.length)[0];
  if (!shortest) {
    throw new Error(`No guide animation action: ${action}`);
  }

  return shortest.path.concat(shortest.step);
}

export function independentBookStateForBookState(state: BookState): IndependentBookState {
  return state === "on_ground" ? "visible" : "hidden";
}

export function independentBookStateForStep(step: GuideAnimationStep, progress: number): IndependentBookState {
  const fromVisible = independentBookStateForBookState(step.from) === "visible";
  const toVisible = independentBookStateForBookState(step.to) === "visible";
  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (fromVisible === toVisible) {
    return fromVisible ? "visible" : "hidden";
  }

  if (fromVisible && !toVisible) {
    return clampedProgress < 0.42 ? "visible" : "hidden";
  }

  return clampedProgress >= 0.58 ? "visible" : "hidden";
}
