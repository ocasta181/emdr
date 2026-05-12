export type VaultRouteService = {
  status(): Promise<unknown> | unknown;
  create(password: unknown): Promise<unknown> | unknown;
  unlockWithPassword(password: unknown): Promise<unknown> | unknown;
  unlockWithRecoveryCode(recoveryCode: unknown): Promise<unknown> | unknown;
  exportVault(): Promise<unknown> | unknown;
  importVault(): Promise<unknown> | unknown;
};
