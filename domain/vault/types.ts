export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export type UnlockedVault = {
  dataKey: Buffer;
  plaintext: Buffer;
};
