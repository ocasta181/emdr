import type { Database } from "./types";
import { createEmptyDatabase } from "./domain/app/factory";
import { nowIso } from "./support/ids";

const STORAGE_KEY = "emdr-local-dev-db";

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
