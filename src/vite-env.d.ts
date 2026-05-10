/// <reference types="vite/client" />

interface Window {
  emdr?: {
    loadDatabase: () => Promise<unknown | null>;
    saveDatabase: (database: unknown) => Promise<{ ok: true; path: string }>;
  };
}
