export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export type UnlockedVault = {
  dataKey: Buffer;
  plaintext: Buffer;
};

export type VaultIpcService = {
  status(): VaultStatus | Promise<VaultStatus>;
  create(password: string): { recoveryCode: string } | Promise<{ recoveryCode: string }>;
  unlockWithPassword(password: string): { ok: true } | Promise<{ ok: true }>;
  unlockWithRecoveryCode(recoveryCode: string): { ok: true } | Promise<{ ok: true }>;
  exportVault(): { canceled: true } | { canceled: false; path: string } | Promise<{ canceled: true } | { canceled: false; path: string }>;
  importVault(): { canceled: boolean } | Promise<{ canceled: boolean }>;
};

export type VaultStorage = {
  status(): VaultStatus;
  create(password: string): Promise<{ recoveryCode: string }>;
  unlockWithPassword(password: string): Promise<void>;
  unlockWithRecoveryCode(recoveryCode: string): Promise<void>;
  lock(): void;
};
