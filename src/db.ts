import type { Database } from "./types";

const STORAGE_KEY = "emdr-local-dev-db";

export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export async function getVaultStatus(): Promise<VaultStatus> {
  return window.emdr ? window.emdr.request<VaultStatus>("vault:status") : "unlocked";
}

export async function createVault(password: string) {
  return window.emdr ? window.emdr.request<{ recoveryCode: string }>("vault:create", password) : { recoveryCode: "" };
}

export async function unlockWithPassword(password: string) {
  if (window.emdr) {
    await window.emdr.request("vault:unlock-password", password);
  }
}

export async function unlockWithRecoveryCode(recoveryCode: string) {
  if (window.emdr) {
    await window.emdr.request("vault:unlock-recovery", recoveryCode);
  }
}

export async function exportVault() {
  return window.emdr
    ? window.emdr.request<{ canceled: true } | { canceled: false; path: string }>("vault:export")
    : { canceled: true as const };
}

export async function importVault() {
  return window.emdr ? window.emdr.request<{ canceled: boolean }>("vault:import") : { canceled: true };
}

export async function loadDatabase(): Promise<Database> {
  if (window.emdr) {
    const loaded = await window.emdr.request<unknown | null>("legacy:load-database");
    return loaded ? (loaded as Database) : emptyDatabase();
  }

  const loaded = localStorage.getItem(STORAGE_KEY);
  return loaded ? (JSON.parse(loaded) as Database) : emptyDatabase();
}

export async function saveDatabase(database: Database) {
  if (window.emdr) {
    await window.emdr.request("legacy:save-database", database);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  }
}

function emptyDatabase(): Database {
  return {
    targets: [],
    sessions: [],
    settings: {
      bilateralStimulation: {
        speed: 1,
        dotSize: "medium",
        dotColor: "green"
      }
    }
  };
}
