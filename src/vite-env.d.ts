/// <reference types="vite/client" />

interface Window {
  emdr?: {
    vaultStatus: () => Promise<"setupRequired" | "locked" | "unlocked">;
    createVault: (password: string) => Promise<{ recoveryCode: string }>;
    unlockWithPassword: (password: string) => Promise<{ ok: true }>;
    unlockWithRecoveryCode: (recoveryCode: string) => Promise<{ ok: true }>;
    loadDatabase: () => Promise<unknown | null>;
    saveDatabase: (database: unknown) => Promise<{ ok: true; path: string }>;
  };
}
