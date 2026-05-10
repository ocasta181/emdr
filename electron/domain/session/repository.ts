import type { SqliteDatabase } from "../../../infrastructure/sqlite/database.js";
import { optionalNumber, optionalString, stringValue } from "../../../infrastructure/sqlite/database.js";
import { createRepository } from "../../../infrastructure/sqlite/repository.js";
import type { Session } from "./entity.js";

const columns = [
  "id",
  "target_root_id",
  "target_id",
  "started_at",
  "ended_at",
  "assessment_image",
  "assessment_negative_cognition",
  "assessment_positive_cognition",
  "assessment_believability",
  "assessment_emotions",
  "assessment_disturbance",
  "assessment_body_location",
  "final_disturbance",
  "notes"
];

export function ensureSessionTable(db: SqliteDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      target_root_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_session_target ON "session"(target_root_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_session_started ON "session"(started_at);
  `);
}

export function readSessions(db: SqliteDatabase): Session[] {
  return sessionRepository(db).all();
}

export function replaceSessions(db: SqliteDatabase, sessions: Session[]) {
  sessionRepository(db).replaceAll(sessions);
}

function sessionRepository(db: SqliteDatabase) {
  return createRepository<Session>(db, {
    tableName: "session",
    primaryKey: "id",
    columns,
    orderBy: "started_at ASC",
    toRow: writeSession,
    fromRow: readSession
  });
}

function writeSession(session: Session) {
  return {
    id: session.id,
    target_root_id: session.targetRootId,
    target_id: session.targetId,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? null,
    assessment_image: session.assessmentImage ?? null,
    assessment_negative_cognition: session.assessmentNegativeCognition,
    assessment_positive_cognition: session.assessmentPositiveCognition,
    assessment_believability: session.assessmentBelievability ?? null,
    assessment_emotions: session.assessmentEmotions ?? null,
    assessment_disturbance: session.assessmentDisturbance ?? null,
    assessment_body_location: session.assessmentBodyLocation ?? null,
    final_disturbance: session.finalDisturbance ?? null,
    notes: session.notes ?? null
  };
}

function readSession(row: Record<string, unknown>): Session {
  return {
    id: stringValue(row.id),
    targetRootId: stringValue(row.target_root_id),
    targetId: stringValue(row.target_id),
    startedAt: stringValue(row.started_at),
    endedAt: optionalString(row.ended_at),
    assessmentImage: optionalString(row.assessment_image),
    assessmentNegativeCognition: stringValue(row.assessment_negative_cognition),
    assessmentPositiveCognition: stringValue(row.assessment_positive_cognition),
    assessmentBelievability: optionalNumber(row.assessment_believability),
    assessmentEmotions: optionalString(row.assessment_emotions),
    assessmentDisturbance: optionalNumber(row.assessment_disturbance),
    assessmentBodyLocation: optionalString(row.assessment_body_location),
    finalDisturbance: optionalNumber(row.final_disturbance),
    notes: optionalString(row.notes)
  };
}
