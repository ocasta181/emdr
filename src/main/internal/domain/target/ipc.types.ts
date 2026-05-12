export type TargetRouteService = {
  list(): Promise<unknown> | unknown;
  listAll(): Promise<unknown> | unknown;
  create(payload: unknown): Promise<unknown> | unknown;
  revise(payload: unknown): Promise<unknown> | unknown;
};
