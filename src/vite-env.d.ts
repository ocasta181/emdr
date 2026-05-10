/// <reference types="vite/client" />

interface Window {
  emdr?: {
    vaultStatus: () => Promise<"setupRequired" | "locked" | "unlocked">;
    createVault: (password: string) => Promise<{ recoveryCode: string }>;
    unlockWithPassword: (password: string) => Promise<{ ok: true }>;
    unlockWithRecoveryCode: (recoveryCode: string) => Promise<{ ok: true }>;
    exportVault: () => Promise<{ canceled: true } | { canceled: false; path: string }>;
    importVault: () => Promise<{ canceled: boolean }>;
    loadDatabase: () => Promise<unknown | null>;
    saveDatabase: (database: unknown) => Promise<{ ok: true; path: string }>;
  };
}
