import type { SqliteDatabase } from "../connection.js";

export function up(db: SqliteDatabase) {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS target (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES target(id) DEFERRABLE INITIALLY DEFERRED,
      is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      description TEXT NOT NULL,
      negative_cognition TEXT NOT NULL,
      positive_cognition TEXT NOT NULL,
      cluster_tag TEXT,
      initial_disturbance REAL,
      current_disturbance REAL,
      status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'deferred')),
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_target_parent ON target(parent_id);
    CREATE INDEX IF NOT EXISTS idx_target_current ON target(is_current, status, current_disturbance);

    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL REFERENCES target(id) DEFERRABLE INITIALLY DEFERRED,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      assessment_image TEXT,
      assessment_negative_cognition TEXT NOT NULL,
      assessment_positive_cognition TEXT NOT NULL,
      assessment_believability REAL,
      assessment_emotions TEXT,
      assessment_disturbance REAL,
      assessment_body_location TEXT,
      final_disturbance REAL,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_session_target ON "session"(target_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_session_started ON "session"(started_at);

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

    CREATE TABLE IF NOT EXISTS setting (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
}
