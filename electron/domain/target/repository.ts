import type { SqliteDatabase } from "../../../infrastructure/sqlite/database.js";
import { numberValue, optionalNumber, optionalString, stringValue } from "../../../infrastructure/sqlite/database.js";
import { createRepository } from "../../../infrastructure/sqlite/repository.js";
import type { Target, TargetStatus } from "./entity.js";

const columns = [
  "id",
  "root_target_id",
  "parent_target_id",
  "is_current",
  "created_at",
  "updated_at",
  "description",
  "negative_cognition",
  "positive_cognition",
  "cluster_tag",
  "initial_disturbance",
  "current_disturbance",
  "status",
  "notes"
];

export function ensureTargetTable(db: SqliteDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS target (
      id TEXT PRIMARY KEY,
      root_target_id TEXT NOT NULL,
      parent_target_id TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_target_root ON target(root_target_id);
    CREATE INDEX IF NOT EXISTS idx_target_current ON target(is_current, status, current_disturbance);
  `);
}

export function readTargets(db: SqliteDatabase): Target[] {
  return targetRepository(db).all();
}

export function replaceTargets(db: SqliteDatabase, targets: Target[]) {
  targetRepository(db).replaceAll(targets);
}

function targetRepository(db: SqliteDatabase) {
  return createRepository<Target>(db, {
    tableName: "target",
    primaryKey: "id",
    columns,
    orderBy: "created_at ASC",
    toRow: writeTarget,
    fromRow: readTarget
  });
}

function writeTarget(target: Target) {
  return {
    id: target.id,
    root_target_id: target.rootTargetId,
    parent_target_id: target.parentTargetId ?? null,
    is_current: target.isCurrent ? 1 : 0,
    created_at: target.createdAt,
    updated_at: target.updatedAt,
    description: target.description,
    negative_cognition: target.negativeCognition,
    positive_cognition: target.positiveCognition,
    cluster_tag: target.clusterTag ?? null,
    initial_disturbance: target.initialDisturbance ?? null,
    current_disturbance: target.currentDisturbance ?? null,
    status: target.status,
    notes: target.notes ?? null
  };
}

function readTarget(row: Record<string, unknown>): Target {
  return {
    id: stringValue(row.id),
    rootTargetId: stringValue(row.root_target_id),
    parentTargetId: optionalString(row.parent_target_id),
    isCurrent: numberValue(row.is_current) === 1,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    description: stringValue(row.description),
    negativeCognition: stringValue(row.negative_cognition),
    positiveCognition: stringValue(row.positive_cognition),
    clusterTag: optionalString(row.cluster_tag),
    initialDisturbance: optionalNumber(row.initial_disturbance),
    currentDisturbance: optionalNumber(row.current_disturbance),
    status: stringValue(row.status) as TargetStatus,
    notes: optionalString(row.notes)
  };
}
