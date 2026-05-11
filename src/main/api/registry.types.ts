export type ApiRouteHandler<Request = unknown, Response = unknown> = (
  request: Request
) => Response | Promise<Response>;

export type ApiRegistry = {
  handle<Request = unknown, Response = unknown>(
    route: string,
    handler: ApiRouteHandler<Request, Response>
  ): void;
  dispatch(route: string, payload: unknown): Promise<unknown>;
  routes(): string[];
};
