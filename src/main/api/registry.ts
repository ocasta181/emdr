import type { ApiRegistry, ApiRouteHandler } from "./registry.types.js";

export function createApiRegistry(): ApiRegistry {
  const handlers = new Map<string, ApiRouteHandler>();

  return {
    handle(route, handler) {
      if (handlers.has(route)) {
        throw new Error(`API route is already registered: ${route}`);
      }
      handlers.set(route, handler as ApiRouteHandler);
    },

    async dispatch(route, payload) {
      const handler = handlers.get(route);
      if (!handler) {
        throw new Error(`API route is not registered: ${route}`);
      }
      return handler(payload);
    },

    routes() {
      return [...handlers.keys()];
    }
  };
}
