import type { Assessment, StimulationSet } from "../../../shared/types";
import { sudAnchors, vocAnchors } from "../../components/ScaleInput";

/**
 * The guide's structured questions for each session step.
 *
 * Questions are derived from durable data: a question counts as answered once its field holds a value,
 * so a session reopened later resumes at the first open question. Skips live only in the renderer.
 */
export type GuidedInput =
  | { kind: "text"; placeholder: string }
  | { kind: "scale"; label: string; min: number; max: number; anchors: [string, string] };

export type GuidedQuestion = {
  id: string;
  prompt: string;
  input: GuidedInput;
  /** Display form of the saved answer, when there is one. */
  answer?: string;
};

export type AssessmentField = Exclude<keyof Assessment, never>;

type AssessmentQuestion = GuidedQuestion & { field: AssessmentField };

export function preparationQuestions(assessment: Assessment): AssessmentQuestion[] {
  const positive = assessment.positiveCognition.trim();
  const negative = assessment.negativeCognition.trim();
  return [
    {
      id: "assessment.image",
      field: "image",
      prompt: "Bring the memory to mind. What image represents the worst part of it?",
      input: { kind: "text", placeholder: "Describe the image in a few words…" },
      answer: textAnswer(assessment.image)
    },
    {
      id: "assessment.negativeCognition",
      field: "negativeCognition",
      prompt: "As you hold that image, what words go with it that express a negative belief about yourself now?",
      input: { kind: "text", placeholder: "For example: I am not safe" },
      answer: textAnswer(assessment.negativeCognition)
    },
    {
      id: "assessment.positiveCognition",
      field: "positiveCognition",
      prompt: "When you bring up that image, what would you like to believe about yourself instead?",
      input: { kind: "text", placeholder: "For example: I am safe now" },
      answer: textAnswer(assessment.positiveCognition)
    },
    {
      id: "assessment.believability",
      field: "believability",
      prompt: positive
        ? `Thinking of the image, how true do the words “${positive}” feel to you now?`
        : "Thinking of the image, how true does that positive belief feel to you now?",
      input: { kind: "scale", label: "VOC", min: 1, max: 7, anchors: vocAnchors },
      answer: numberAnswer(assessment.believability)
    },
    {
      id: "assessment.emotions",
      field: "emotions",
      prompt: negative
        ? `When you bring up the image and the words “${negative}”, what emotions do you feel now?`
        : "When you bring up the image, what emotions do you feel now?",
      input: { kind: "text", placeholder: "For example: fear, sadness" },
      answer: textAnswer(assessment.emotions)
    },
    {
      id: "assessment.disturbance",
      field: "disturbance",
      prompt: "How disturbing does it feel to you now?",
      input: { kind: "scale", label: "SUD", min: 0, max: 10, anchors: sudAnchors },
      answer: numberAnswer(assessment.disturbance)
    },
    {
      id: "assessment.bodyLocation",
      field: "bodyLocation",
      prompt: "Where do you feel it in your body?",
      input: { kind: "text", placeholder: "For example: tight chest" },
      answer: textAnswer(assessment.bodyLocation)
    }
  ];
}

export function setReflectionQuestions(set: StimulationSet): Array<GuidedQuestion & { field: "observation" | "disturbance" }> {
  return [
    {
      id: `set.${set.id}.observation`,
      field: "observation",
      prompt: "Take a breath. What do you notice now?",
      input: { kind: "text", placeholder: "Whatever comes up is fine…" },
      answer: textAnswer(set.observation)
    },
    {
      id: `set.${set.id}.disturbance`,
      field: "disturbance",
      prompt: "If you like, how disturbing does it feel right now?",
      input: { kind: "scale", label: "Set SUD", min: 0, max: 10, anchors: sudAnchors },
      answer: numberAnswer(set.disturbance)
    }
  ];
}

export type ReviewDraft = { finalDisturbance?: number; notes?: string };

export function reviewQuestions(draft: ReviewDraft): Array<GuidedQuestion & { field: keyof ReviewDraft }> {
  return [
    {
      id: "review.finalDisturbance",
      field: "finalDisturbance",
      prompt: "Bring up the memory once more. How disturbing does it feel now?",
      input: { kind: "scale", label: "Final SUD", min: 0, max: 10, anchors: sudAnchors },
      answer: numberAnswer(draft.finalDisturbance)
    },
    {
      id: "review.notes",
      field: "notes",
      prompt: "Is there anything from today you would like to keep in your notes?",
      input: { kind: "text", placeholder: "A few words for your future self…" },
      answer: textAnswer(draft.notes)
    }
  ];
}

/** The first question that has neither an answer nor a skip. */
export function pendingQuestion<Q extends GuidedQuestion>(questions: Q[], skipped: ReadonlySet<string>): Q | undefined {
  return questions.find((question) => question.answer === undefined && !skipped.has(question.id));
}

function textAnswer(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberAnswer(value: number | undefined) {
  return value === undefined ? undefined : String(value);
}
