import type { Database } from "./types";
import { createEmptyDatabase } from "../domain/app/factory";
import { nowIso } from "../utils";

const STORAGE_KEY = "emdr-local-dev-db";

export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export async function getVaultStatus(): Promise<VaultStatus> {
  return window.emdr ? window.emdr.vaultStatus() : "unlocked";
}

export async function createVault(password: string) {
  return window.emdr ? window.emdr.createVault(password) : { recoveryCode: "" };
}

export async function unlockWithPassword(password: string) {
  if (window.emdr) {
    await window.emdr.unlockWithPassword(password);
  }
}

export async function unlockWithRecoveryCode(recoveryCode: string) {
  if (window.emdr) {
    await window.emdr.unlockWithRecoveryCode(recoveryCode);
  }
}

export async function loadDatabase(): Promise<Database> {
  if (window.emdr) {
    const loaded = await window.emdr.loadDatabase();
    return loaded ? (loaded as Database) : createEmptyDatabase();
  }

  const loaded = localStorage.getItem(STORAGE_KEY);
  return loaded ? (JSON.parse(loaded) as Database) : createEmptyDatabase();
}

export async function saveDatabase(database: Database) {
  const next = {
    ...database,
    updatedAt: nowIso()
  };

  if (window.emdr) {
    await window.emdr.saveDatabase(next);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}
