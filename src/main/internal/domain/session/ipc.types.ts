export type SessionRouteService = {
  list(): Promise<unknown> | unknown;
  start(payload: unknown): Promise<unknown> | unknown;
  updateAssessment(payload: unknown): Promise<unknown> | unknown;
  transitionFlow(payload: unknown): Promise<unknown> | unknown;
  end(payload: unknown): Promise<unknown> | unknown;
};
