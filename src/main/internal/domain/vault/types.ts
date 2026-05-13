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
  lock(): { ok: true } | Promise<{ ok: true }>;
  defaultExportName(): string;
  exportVault(destinationPath: string): void | Promise<void>;
  importVault(sourcePath: string): void | Promise<void>;
};

export type VaultStoreAccess = {
  isUnlocked(): boolean;
  createPlaintext(): Promise<Buffer>;
  unlock(unlocked: UnlockedVault): void | Promise<void>;
  lock(): void;
};
