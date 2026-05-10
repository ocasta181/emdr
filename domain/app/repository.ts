import {
  openSqliteDatabase,
  persistSqliteDatabase,
  sqliteDatabasePath,
  type SqliteDatabase
} from "../../infrastructure/sqlite/database.js";
import { runMigrations } from "../../infrastructure/sqlite/migrations/index.js";
import { newAppMetadataRepository } from "../app-metadata/repository.js";
import { newSessionRepository } from "../session/repository.js";
import type { Session } from "../session/entity.js";
import type { SessionAggregate } from "../session/types.js";
import { newSettingRepository } from "../setting/repository.js";
import type { Settings } from "../setting/types.js";
import { newStimulationSetRepository } from "../stimulation-set/repository.js";
import type { StimulationSet } from "../stimulation-set/entity.js";
import { newTargetRepository } from "../target/repository.js";
import { createEmptyDatabase } from "./factory.js";
import type { Database } from "./types.js";

let databasePromise: Promise<SqliteDatabase> | undefined;
let activePath: string | undefined;

export async function loadAppDatabase(userDataPath: string): Promise<Database> {
  const db = await openDatabase(userDataPath);
  return readAppDatabase(db);
}

export async function saveAppDatabase(userDataPath: string, database: Database) {
  const db = await openDatabase(userDataPath);
  writeAppDatabase(db, database);
  await persistSqliteDatabase(db, sqliteDatabasePath(userDataPath));
}

async function openDatabase(userDataPath: string) {
  if (databasePromise && activePath === userDataPath) {
    return databasePromise;
  }

  activePath = userDataPath;
  databasePromise = openDatabaseFromDisk(userDataPath);
  return databasePromise;
}

async function openDatabaseFromDisk(userDataPath: string) {
  const sqlitePath = sqliteDatabasePath(userDataPath);
  const db = await openSqliteDatabase(sqlitePath);
  runMigrations(db);

  if (!newAppMetadataRepository(db).find("createdAt")) {
    writeAppDatabase(db, createEmptyDatabase());
    await persistSqliteDatabase(db, sqlitePath);
  }

  return db;
}

function readAppDatabase(db: SqliteDatabase): Database {
  const metadata = newAppMetadataRepository(db);
  const createdAt = metadata.find("createdAt")?.value ?? new Date().toISOString();
  const updatedAt = metadata.find("updatedAt")?.value ?? createdAt;

  return {
    schemaVersion: 1,
    createdAt,
    updatedAt,
    targets: newTargetRepository(db).all(),
    sessions: readSessionAggregates(db),
    settings: readSettings(db)
  };
}

function writeAppDatabase(db: SqliteDatabase, database: Database) {
  db.run("BEGIN TRANSACTION");

  try {
    newTargetRepository(db).replaceAll(database.targets);
    newSessionRepository(db).replaceAll(database.sessions.map(toSession));
    newStimulationSetRepository(db).replaceAll(database.sessions.flatMap((session) => session.stimulationSets));
    newSettingRepository(db).replaceAll([
      { key: "bilateralStimulation", valueJson: JSON.stringify(database.settings.bilateralStimulation) }
    ]);
    newAppMetadataRepository(db).replaceAll([
      { key: "schemaVersion", value: String(database.schemaVersion) },
      { key: "createdAt", value: database.createdAt },
      { key: "updatedAt", value: database.updatedAt }
    ]);

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

function readSessionAggregates(db: SqliteDatabase): SessionAggregate[] {
  const setsBySession = new Map<string, StimulationSet[]>();
  for (const set of newStimulationSetRepository(db).all()) {
    const sets = setsBySession.get(set.sessionId) ?? [];
    sets.push(set);
    setsBySession.set(set.sessionId, sets);
  }

  return newSessionRepository(db).all().map((session) => toSessionAggregate(session, setsBySession.get(session.id) ?? []));
}

function readSettings(db: SqliteDatabase): Settings {
  const bilateralStimulation = newSettingRepository(db).find("bilateralStimulation");

  return {
    bilateralStimulation: bilateralStimulation ? JSON.parse(bilateralStimulation.valueJson) : {
      speed: 1,
      dotSize: "medium",
      dotColor: "green"
    }
  };
}

function toSession(session: SessionAggregate): Session {
  return {
    id: session.id,
    targetRootId: session.targetRootId,
    targetId: session.targetId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    assessmentImage: session.assessment.image,
    assessmentNegativeCognition: session.assessment.negativeCognition,
    assessmentPositiveCognition: session.assessment.positiveCognition,
    assessmentBelievability: session.assessment.believability,
    assessmentEmotions: session.assessment.emotions,
    assessmentDisturbance: session.assessment.disturbance,
    assessmentBodyLocation: session.assessment.bodyLocation,
    finalDisturbance: session.finalDisturbance,
    notes: session.notes
  };
}

function toSessionAggregate(session: Session, stimulationSets: StimulationSet[]): SessionAggregate {
  return {
    id: session.id,
    targetRootId: session.targetRootId,
    targetId: session.targetId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    assessment: {
      image: session.assessmentImage,
      negativeCognition: session.assessmentNegativeCognition,
      positiveCognition: session.assessmentPositiveCognition,
      believability: session.assessmentBelievability,
      emotions: session.assessmentEmotions,
      disturbance: session.assessmentDisturbance,
      bodyLocation: session.assessmentBodyLocation
    },
    stimulationSets,
    finalDisturbance: session.finalDisturbance,
    notes: session.notes
  };
}
