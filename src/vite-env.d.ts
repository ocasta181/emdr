/// <reference types="vite/client" />

interface Window {
  emdr?: {
    request: <Response = unknown>(route: string, payload?: unknown) => Promise<Response>;
    subscribe: (topic: string, callback: (payload: unknown) => void) => () => void;
  };
}
