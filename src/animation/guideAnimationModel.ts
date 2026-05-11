import type { AnimatedGuideState } from "../../domain/app/animatedGuideMachine";

export type GuideActivity = "idle" | "speaking" | "thinking" | "paused";

export type TargetBookState = "at_rest" | "held_closed" | "open_read" | "open_write";

export type GuideObjectState = {
  targetBook: TargetBookState;
};

export type GuideAnimationViewModel = {
  guideActivity: GuideActivity;
  guidePose: GuidePose | null;
  objects: GuideObjectState;
};

export type GuideIdlePose = "idle" | "idle_closed_book" | "idle_open_book";

export type GuidePose =
  | "idle"
  | "speaking"
  | "thinking"
  | "idle_to_speaking"
  | "idle_to_thinking"
  | "idle_to_idle_closed_book"
  | "idle_closed_book"
  | "idle_closed_book_to_speaking_closed_book"
  | "speaking_closed_book"
  | "idle_closed_book_to_thinking_closed_book"
  | "thinking_closed_book"
  | "idle_closed_book_to_idle_open_book"
  | "idle_open_book"
  | "idle_open_book_to_speaking_open_book"
  | "speaking_open_book"
  | "idle_open_book_to_thinking_open_book"
  | "thinking_open_book"
  | "flip_book_pages"
  | "write_in_book";

export type GuideTransitionStep = {
  from: GuideIdlePose;
  to: GuideIdlePose;
  pose: GuidePose;
  reverse: boolean;
};

export type DesiredGuideAnimation = {
  pose: GuidePose;
};

export type IndependentBookState = "visible" | "hidden";

const idlePoseTransitions: Array<{ from: GuideIdlePose; to: GuideIdlePose; pose: GuidePose }> = [
  { from: "idle", to: "idle_closed_book", pose: "idle_to_idle_closed_book" },
  { from: "idle_closed_book", to: "idle_open_book", pose: "idle_closed_book_to_idle_open_book" }
];

export function deriveGuideAnimationViewModel(state: AnimatedGuideState): GuideAnimationViewModel {
  switch (state) {
    case "speaking":
      return baseViewModel("speaking");
    case "idle":
      return baseViewModel("idle");
    case "targets_reading":
      return targetBookViewModel("idle", null, "open_read");
    case "targets_browsing":
      return targetBookViewModel("idle", "flip_book_pages", "open_read");
    case "targets_writing":
      return targetBookViewModel("idle", "write_in_book", "open_write");
    case "thinking":
      return baseViewModel("thinking");
  }
}

export function guideAnimationForViewModel(viewModel: GuideAnimationViewModel): DesiredGuideAnimation {
  return {
    pose: guidePoseForViewModel(viewModel)
  };
}

export function planGuidePoseTransitions(from: GuideIdlePose, to: GuideIdlePose): GuideTransitionStep[] {
  if (from === to) return [];

  const queue: Array<{ pose: GuideIdlePose; path: GuideTransitionStep[] }> = [{ pose: from, path: [] }];
  const visited = new Set<GuideIdlePose>([from]);

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

export function idlePoseForGuidePose(pose: GuidePose): GuideIdlePose {
  if (pose === "idle") return "idle";
  if (pose.endsWith("_closed_book")) return "idle_closed_book";
  if (pose.endsWith("_open_book") || pose === "flip_book_pages" || pose === "write_in_book") return "idle_open_book";
  return "idle";
}

export function isOneShotGuidePose(pose: GuidePose): boolean {
  return pose === "flip_book_pages" || pose === "write_in_book";
}

function guidePoseForViewModel(viewModel: GuideAnimationViewModel): GuidePose {
  if (viewModel.guidePose) return viewModel.guidePose;

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

function transitionStepsFrom(from: GuideIdlePose): GuideTransitionStep[] {
  return idlePoseTransitions.flatMap((edge): GuideTransitionStep[] => {
    if (edge.from === from) {
      return [{ from, to: edge.to, pose: edge.pose, reverse: false }];
    }

    if (edge.to === from) {
      return [{ from, to: edge.from, pose: edge.pose, reverse: true }];
    }

    return [];
  });
}

function guidePoseIncludesBook(pose: GuidePose) {
  return pose.endsWith("_book");
}

function baseViewModel(guideActivity: GuideActivity): GuideAnimationViewModel {
  return {
    guideActivity,
    guidePose: null,
    objects: { targetBook: "at_rest" }
  };
}

function targetBookViewModel(
  guideActivity: GuideActivity,
  guidePose: GuidePose | null,
  targetBook: TargetBookState
): GuideAnimationViewModel {
  return {
    guideActivity,
    guidePose,
    objects: { targetBook }
  };
}
