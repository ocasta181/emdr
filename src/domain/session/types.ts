import type { StimulationSet } from "../stimulation-set/entity";
import type { Session } from "./entity";

export type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  believability?: number;
  emotions?: string;
  disturbance?: number;
  bodyLocation?: string;
};

export type SessionAggregate = Omit<
  Session,
  | "assessmentImage"
  | "assessmentNegativeCognition"
  | "assessmentPositiveCognition"
  | "assessmentBelievability"
  | "assessmentEmotions"
  | "assessmentDisturbance"
  | "assessmentBodyLocation"
> & {
  assessment: Assessment;
  stimulationSets: StimulationSet[];
};
