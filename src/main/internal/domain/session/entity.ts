export type Session = {
  id: string;
  targetId: string;
  startedAt: string;
  endedAt?: string;
  assessmentImage?: string;
  assessmentNegativeCognition: string;
  assessmentPositiveCognition: string;
  assessmentBelievability?: number;
  assessmentEmotions?: string;
  assessmentDisturbance?: number;
  assessmentBodyLocation?: string;
  finalDisturbance?: number;
  notes?: string;
};
