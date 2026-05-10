import type { SessionFlowState } from "../../domain/session/types";

export type GuideActivity = "idle" | "speaking" | "thinking" | "stimulation_focus" | "paused";

export type TargetBookState = "at_rest" | "held_closed" | "open_read" | "open_write";

export type GuideBookAction = "flip_book_pages" | "write_in_book";

export type SceneFocus = "guide" | "target_book" | "stimulation" | "settings" | "history";

export type SceneObjectState = {
  targetBook: TargetBookState;
};

export type SceneViewModel = {
  guideActivity: GuideActivity;
  guideAction: GuideBookAction | null;
  objects: SceneObjectState;
  focus: SceneFocus;
};

export type SceneContext = {
  targetMode?: "closed" | "reading" | "writing" | "browsing";
  sessionState?: SessionFlowState;
  stimulationRunning?: boolean;
  panel?: "chat" | "targets" | "history" | "settings" | null;
  guideSpeaking?: boolean;
  userTyping?: boolean;
};

export type GuidePose =
  | "idle"
  | "speaking"
  | "thinking"
  | "idle_closed_book"
  | "speaking_closed_book"
  | "thinking_closed_book"
  | "idle_open_book"
  | "speaking_open_book"
  | "thinking_open_book";

export type GuideTransitionClip =
  | "idle_to_speaking"
  | "idle_to_thinking"
  | "idle_to_idle_closed_book"
  | "idle_closed_book_to_speaking_closed_book"
  | "idle_closed_book_to_thinking_closed_book"
  | "idle_closed_book_to_idle_open_book"
  | "idle_open_book_to_speaking_open_book"
  | "idle_open_book_to_thinking_open_book";

export type GuideSpriteClip = GuidePose | GuideBookAction | GuideTransitionClip;

export type GuideTransitionStep = {
  from: GuidePose;
  to: GuidePose;
  clip: GuideTransitionClip;
  reverse: boolean;
};

export type DesiredGuideAnimation = {
  pose: GuidePose;
  action: GuideBookAction | null;
};

export type IndependentBookState = "visible" | "hidden";

const transitionEdges: Array<{ from: GuidePose; to: GuidePose; clip: GuideTransitionClip }> = [
  { from: "idle", to: "speaking", clip: "idle_to_speaking" },
  { from: "idle", to: "thinking", clip: "idle_to_thinking" },
  { from: "idle", to: "idle_closed_book", clip: "idle_to_idle_closed_book" },
  {
    from: "idle_closed_book",
    to: "speaking_closed_book",
    clip: "idle_closed_book_to_speaking_closed_book"
  },
  {
    from: "idle_closed_book",
    to: "thinking_closed_book",
    clip: "idle_closed_book_to_thinking_closed_book"
  },
  { from: "idle_closed_book", to: "idle_open_book", clip: "idle_closed_book_to_idle_open_book" },
  { from: "idle_open_book", to: "speaking_open_book", clip: "idle_open_book_to_speaking_open_book" },
  { from: "idle_open_book", to: "thinking_open_book", clip: "idle_open_book_to_thinking_open_book" }
];

export function deriveSceneViewModel(context: SceneContext): SceneViewModel {
  if (context.stimulationRunning || context.sessionState === "stimulation") {
    return {
      guideActivity: "stimulation_focus",
      guideAction: null,
      objects: { targetBook: "at_rest" },
      focus: "stimulation"
    };
  }

  if (context.targetMode === "writing") {
    return {
      guideActivity: "idle",
      guideAction: "write_in_book",
      objects: { targetBook: "open_write" },
      focus: "target_book"
    };
  }

  if (context.targetMode === "browsing") {
    return {
      guideActivity: "idle",
      guideAction: "flip_book_pages",
      objects: { targetBook: "open_read" },
      focus: "target_book"
    };
  }

  if (context.targetMode === "reading" || context.panel === "targets") {
    return {
      guideActivity: "idle",
      guideAction: null,
      objects: { targetBook: "open_read" },
      focus: "target_book"
    };
  }

  if (context.sessionState === "interjection") {
    return {
      guideActivity: "paused",
      guideAction: null,
      objects: { targetBook: "at_rest" },
      focus: "guide"
    };
  }

  if (context.guideSpeaking || context.panel === "chat") {
    return baseViewModel("speaking", "guide");
  }

  if (context.panel === "settings") {
    return baseViewModel("thinking", "settings");
  }

  if (context.panel === "history") {
    return baseViewModel("thinking", "history");
  }

  return baseViewModel("idle", "guide");
}

export function guideAnimationForScene(viewModel: SceneViewModel): DesiredGuideAnimation {
  return {
    pose: guidePoseForScene(viewModel),
    action: viewModel.guideAction
  };
}

export function planGuidePoseTransitions(from: GuidePose, to: GuidePose): GuideTransitionStep[] {
  if (from === to) return [];

  const queue: Array<{ pose: GuidePose; path: GuideTransitionStep[] }> = [{ pose: from, path: [] }];
  const visited = new Set<GuidePose>([from]);

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;

    for (const step of transitionStepsFrom(next.pose)) {
      if (visited.has(step.to)) continue;
      const path = next.path.concat(step);
      if (step.to === to) return path;
      visited.add(step.to);
      queue.push({ pose: step.to, path });
    }
  }

  return [];
}

export function independentBookStateForPose(pose: GuidePose): IndependentBookState {
  return guidePoseIncludesBook(pose) ? "hidden" : "visible";
}

export function independentBookStateForTransition(
  transition: GuideTransitionStep,
  progress: number
): IndependentBookState {
  const fromHasBook = guidePoseIncludesBook(transition.from);
  const toHasBook = guidePoseIncludesBook(transition.to);
  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (fromHasBook === toHasBook) {
    return fromHasBook ? "hidden" : "visible";
  }

  if (!fromHasBook && toHasBook) {
    return clampedProgress < 0.42 ? "visible" : "hidden";
  }

  return clampedProgress >= 0.58 ? "visible" : "hidden";
}

function guidePoseForScene(viewModel: SceneViewModel): GuidePose {
  const activity = normalizeGuideActivity(viewModel.guideActivity);

  if (viewModel.objects.targetBook === "held_closed") {
    if (activity === "speaking") return "speaking_closed_book";
    if (activity === "thinking") return "thinking_closed_book";
    return "idle_closed_book";
  }

  if (viewModel.objects.targetBook === "open_read" || viewModel.objects.targetBook === "open_write") {
    if (activity === "speaking") return "speaking_open_book";
    if (activity === "thinking") return "thinking_open_book";
    return "idle_open_book";
  }

  return activity;
}

function normalizeGuideActivity(activity: GuideActivity): "idle" | "speaking" | "thinking" {
  if (activity === "speaking" || activity === "thinking") return activity;
  if (activity === "paused") return "thinking";
  return "idle";
}

function transitionStepsFrom(from: GuidePose): GuideTransitionStep[] {
  return transitionEdges.flatMap((edge): GuideTransitionStep[] => {
    if (edge.from === from) {
      return [{ from, to: edge.to, clip: edge.clip, reverse: false }];
    }

    if (edge.to === from) {
      return [{ from, to: edge.from, clip: edge.clip, reverse: true }];
    }

    return [];
  });
}

function guidePoseIncludesBook(pose: GuidePose) {
  return pose.endsWith("_book");
}

function baseViewModel(guideActivity: GuideActivity, focus: SceneFocus): SceneViewModel {
  return {
    guideActivity,
    guideAction: null,
    objects: { targetBook: "at_rest" },
    focus
  };
}
