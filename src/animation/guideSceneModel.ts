import type { SessionFlowState } from "../../domain/session/types";

export type GuideFocus = "user" | "book" | "stimulation" | "room";

export type GuideBaseIntent = "idle" | "listening" | "thinking" | "speaking" | "stimulation_focus" | "paused";

export type GuideBookIntent =
  | "pick_up_book"
  | "hold_book_closed"
  | "open_book"
  | "hold_book_open"
  | "flip_book_pages"
  | "write_in_book"
  | "close_book"
  | "put_book_down";

export type GuideIntent = GuideBaseIntent | GuideBookIntent;

export type TargetBookMode = "at_rest" | "reading_targets" | "writing_targets";

export type IndependentBookState = "visible" | "hidden";

export type SceneFocus = "guide" | "target_book" | "stimulation" | "settings" | "history";

export type BookHandoff = {
  progress: number;
  action: "attach_to_guide" | "detach_to_rest";
};

export type GuideBookClip = {
  intent: GuideBookIntent;
  label: string;
  focus: GuideFocus;
  loops: boolean;
  startsWithIndependentBook: boolean;
  endsWithIndependentBook: boolean;
  startsWithGuideBook: boolean;
  endsWithGuideBook: boolean;
  handoff?: BookHandoff;
};

export type SceneViewModel = {
  guideIntent: GuideIntent;
  guideFocus: GuideFocus;
  sceneFocus: SceneFocus;
  targetBookMode: TargetBookMode;
  independentBookState: IndependentBookState;
};

export type SceneContext = {
  targetMode?: "closed" | "reading" | "writing" | "browsing";
  sessionState?: SessionFlowState;
  stimulationRunning?: boolean;
  panel?: "chat" | "targets" | "history" | "settings" | null;
  guideSpeaking?: boolean;
  userTyping?: boolean;
};

export const guideBookClips: Record<GuideBookIntent, GuideBookClip> = {
  pick_up_book: {
    intent: "pick_up_book",
    label: "Picking up book",
    focus: "book",
    loops: false,
    startsWithIndependentBook: true,
    endsWithIndependentBook: false,
    startsWithGuideBook: false,
    endsWithGuideBook: true,
    handoff: { progress: 0.42, action: "attach_to_guide" }
  },
  hold_book_closed: {
    intent: "hold_book_closed",
    label: "Holding closed book",
    focus: "user",
    loops: true,
    startsWithIndependentBook: false,
    endsWithIndependentBook: false,
    startsWithGuideBook: true,
    endsWithGuideBook: true
  },
  open_book: {
    intent: "open_book",
    label: "Opening book",
    focus: "book",
    loops: false,
    startsWithIndependentBook: false,
    endsWithIndependentBook: false,
    startsWithGuideBook: true,
    endsWithGuideBook: true
  },
  hold_book_open: {
    intent: "hold_book_open",
    label: "Holding open book",
    focus: "user",
    loops: true,
    startsWithIndependentBook: false,
    endsWithIndependentBook: false,
    startsWithGuideBook: true,
    endsWithGuideBook: true
  },
  flip_book_pages: {
    intent: "flip_book_pages",
    label: "Flipping pages",
    focus: "book",
    loops: false,
    startsWithIndependentBook: false,
    endsWithIndependentBook: false,
    startsWithGuideBook: true,
    endsWithGuideBook: true
  },
  write_in_book: {
    intent: "write_in_book",
    label: "Writing in book",
    focus: "book",
    loops: true,
    startsWithIndependentBook: false,
    endsWithIndependentBook: false,
    startsWithGuideBook: true,
    endsWithGuideBook: true
  },
  close_book: {
    intent: "close_book",
    label: "Closing book",
    focus: "book",
    loops: false,
    startsWithIndependentBook: false,
    endsWithIndependentBook: false,
    startsWithGuideBook: true,
    endsWithGuideBook: true
  },
  put_book_down: {
    intent: "put_book_down",
    label: "Putting book down",
    focus: "book",
    loops: false,
    startsWithIndependentBook: false,
    endsWithIndependentBook: true,
    startsWithGuideBook: true,
    endsWithGuideBook: false,
    handoff: { progress: 0.68, action: "detach_to_rest" }
  }
};

export function deriveSceneViewModel(context: SceneContext): SceneViewModel {
  if (context.stimulationRunning || context.sessionState === "stimulation") {
    return {
      guideIntent: "stimulation_focus",
      guideFocus: "stimulation",
      sceneFocus: "stimulation",
      targetBookMode: "at_rest",
      independentBookState: "visible"
    };
  }

  if (context.targetMode === "writing") {
    return targetBookViewModel("write_in_book", "writing_targets");
  }

  if (context.targetMode === "browsing") {
    return targetBookViewModel("flip_book_pages", "reading_targets");
  }

  if (context.targetMode === "reading" || context.panel === "targets") {
    return targetBookViewModel("hold_book_open", "reading_targets");
  }

  if (context.sessionState === "interjection") {
    return baseViewModel("paused", "user", "guide");
  }

  if (context.userTyping) {
    return baseViewModel("listening", "user", "guide");
  }

  if (context.guideSpeaking || context.panel === "chat") {
    return baseViewModel("speaking", "user", "guide");
  }

  if (context.panel === "settings") {
    return baseViewModel("thinking", "room", "settings");
  }

  return baseViewModel("idle", "room", "guide");
}

export function targetBookTransition(from: TargetBookMode, to: TargetBookMode): GuideBookIntent[] {
  if (from === to) return targetBookSteadyState(to);

  if (from === "at_rest" && to === "reading_targets") {
    return ["pick_up_book", "hold_book_closed", "open_book", "hold_book_open"];
  }

  if (from === "at_rest" && to === "writing_targets") {
    return ["pick_up_book", "hold_book_closed", "open_book", "write_in_book"];
  }

  if (from === "reading_targets" && to === "writing_targets") {
    return ["write_in_book"];
  }

  if (from === "writing_targets" && to === "reading_targets") {
    return ["hold_book_open"];
  }

  if (to === "at_rest") {
    return ["close_book", "put_book_down"];
  }

  return targetBookSteadyState(to);
}

export function independentBookStateForClip(intent: GuideBookIntent, progress: number): IndependentBookState {
  const clip = guideBookClips[intent];
  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (!clip.handoff) {
    return clip.startsWithIndependentBook || clip.endsWithIndependentBook ? "visible" : "hidden";
  }

  if (clip.handoff.action === "attach_to_guide") {
    return clampedProgress < clip.handoff.progress ? "visible" : "hidden";
  }

  return clampedProgress >= clip.handoff.progress ? "visible" : "hidden";
}

function targetBookSteadyState(mode: TargetBookMode): GuideBookIntent[] {
  if (mode === "reading_targets") return ["hold_book_open"];
  if (mode === "writing_targets") return ["write_in_book"];
  return [];
}

function targetBookViewModel(guideIntent: GuideBookIntent, targetBookMode: TargetBookMode): SceneViewModel {
  return {
    guideIntent,
    guideFocus: guideBookClips[guideIntent].focus,
    sceneFocus: "target_book",
    targetBookMode,
    independentBookState: "hidden"
  };
}

function baseViewModel(guideIntent: GuideBaseIntent, guideFocus: GuideFocus, sceneFocus: SceneFocus): SceneViewModel {
  return {
    guideIntent,
    guideFocus,
    sceneFocus,
    targetBookMode: "at_rest",
    independentBookState: "visible"
  };
}
