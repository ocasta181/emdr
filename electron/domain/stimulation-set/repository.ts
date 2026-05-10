import type { SqliteDatabase } from "../../infrastructure/sqlite/database.js";
import { numberValue, optionalNumber, stringValue } from "../../infrastructure/sqlite/database.js";
import { createRepository } from "../../infrastructure/sqlite/repository.js";
import type { StimulationSet } from "./entity.js";

const columns = ["id", "session_id", "set_number", "created_at", "cycle_count", "observation", "disturbance"];

export function ensureStimulationSetTable(db: SqliteDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS stimulation_set (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES "session"(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      cycle_count INTEGER NOT NULL,
      observation TEXT NOT NULL,
      disturbance REAL,
      UNIQUE(session_id, set_number)
    );

    CREATE INDEX IF NOT EXISTS idx_stimulation_set_session ON stimulation_set(session_id, set_number);
  `);
}

export function readStimulationSets(db: SqliteDatabase): StimulationSet[] {
  return stimulationSetRepository(db).all();
}

export function replaceStimulationSets(db: SqliteDatabase, sets: StimulationSet[]) {
  stimulationSetRepository(db).replaceAll(sets);
}

function stimulationSetRepository(db: SqliteDatabase) {
  return createRepository<StimulationSet>(db, {
    tableName: "stimulation_set",
    primaryKey: "id",
    columns,
    orderBy: "session_id ASC, set_number ASC",
    toRow: writeStimulationSet,
    fromRow: readStimulationSet
  });
}

function writeStimulationSet(set: StimulationSet) {
  return {
    id: set.id,
    session_id: set.sessionId,
    set_number: set.setNumber,
    created_at: set.createdAt,
    cycle_count: set.cycleCount,
    observation: set.observation,
    disturbance: set.disturbance ?? null
  };
}

function readStimulationSet(row: Record<string, unknown>): StimulationSet {
  return {
    id: stringValue(row.id),
    sessionId: stringValue(row.session_id),
    setNumber: numberValue(row.set_number),
    createdAt: stringValue(row.created_at),
    cycleCount: numberValue(row.cycle_count),
    observation: stringValue(row.observation),
    disturbance: optionalNumber(row.disturbance)
  };
}
