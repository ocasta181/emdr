export type SessionRouteService = {
  start(payload: unknown): Promise<unknown> | unknown;
  updateAssessment(payload: unknown): Promise<unknown> | unknown;
  transitionFlow(payload: unknown): Promise<unknown> | unknown;
  end(payload: unknown): Promise<unknown> | unknown;
};
