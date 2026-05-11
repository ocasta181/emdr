import type { SqliteDatabase } from "../connection.js";
import { selectAll } from "../connection.js";

export function up(db: SqliteDatabase) {
  const targetColumns = tableColumns(db, "target");
  const sessionColumns = tableColumns(db, "session");
  const needsTargetMigration = targetColumns.has("root_target_id") || targetColumns.has("parent_target_id");
  const needsSessionMigration = sessionColumns.has("target_root_id");

  if (!needsTargetMigration && !needsSessionMigration) {
    createIndexes(db);
    return;
  }

  db.run("PRAGMA foreign_keys = OFF");
  db.run("PRAGMA legacy_alter_table = ON");
  db.run("BEGIN TRANSACTION");

  try {
    if (needsTargetMigration) {
      rebuildTargetTable(db, targetColumns);
    }

    if (needsSessionMigration) {
      rebuildSessionTable(db);
    }

    createIndexes(db);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  } finally {
    db.run("PRAGMA legacy_alter_table = OFF");
    db.run("PRAGMA foreign_keys = ON");
  }

  assertForeignKeys(db);
}

function tableColumns(db: SqliteDatabase, table: string) {
  return new Set(selectAll(db, `PRAGMA table_info(${quoteIdentifier(table)})`).map((row) => String(row.name)));
}

function rebuildTargetTable(db: SqliteDatabase, columns: Set<string>) {
  const parentColumn = columns.has("parent_id") ? "parent_id" : "parent_target_id";

  db.run(`
    DROP INDEX IF EXISTS idx_target_root;
    DROP INDEX IF EXISTS idx_target_parent;
    DROP INDEX IF EXISTS idx_target_current;

    ALTER TABLE target RENAME TO target_old;

    CREATE TABLE target (
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

    INSERT INTO target (
      id,
      parent_id,
      is_current,
      created_at,
      updated_at,
      description,
      negative_cognition,
      positive_cognition,
      cluster_tag,
      initial_disturbance,
      current_disturbance,
      status,
      notes
    )
    SELECT
      id,
      ${quoteIdentifier(parentColumn)},
      is_current,
      created_at,
      updated_at,
      description,
      negative_cognition,
      positive_cognition,
      cluster_tag,
      initial_disturbance,
      current_disturbance,
      status,
      notes
    FROM target_old;

    DROP TABLE target_old;
  `);
}

function rebuildSessionTable(db: SqliteDatabase) {
  db.run(`
    DROP INDEX IF EXISTS idx_session_target;
    DROP INDEX IF EXISTS idx_session_started;

    ALTER TABLE "session" RENAME TO session_old;

    CREATE TABLE "session" (
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

    INSERT INTO "session" (
      id,
      target_id,
      started_at,
      ended_at,
      assessment_image,
      assessment_negative_cognition,
      assessment_positive_cognition,
      assessment_believability,
      assessment_emotions,
      assessment_disturbance,
      assessment_body_location,
      final_disturbance,
      notes
    )
    SELECT
      id,
      target_id,
      started_at,
      ended_at,
      assessment_image,
      assessment_negative_cognition,
      assessment_positive_cognition,
      assessment_believability,
      assessment_emotions,
      assessment_disturbance,
      assessment_body_location,
      final_disturbance,
      notes
    FROM session_old;

    DROP TABLE session_old;
  `);
}

function createIndexes(db: SqliteDatabase) {
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_target_parent ON target(parent_id);
    CREATE INDEX IF NOT EXISTS idx_target_current ON target(is_current, status, current_disturbance);
    CREATE INDEX IF NOT EXISTS idx_session_target ON "session"(target_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_session_started ON "session"(started_at);
  `);
}

function assertForeignKeys(db: SqliteDatabase) {
  const violations = selectAll(db, "PRAGMA foreign_key_check");

  if (violations.length > 0) {
    throw new Error("Target parent migration produced foreign key violations.");
  }
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}
