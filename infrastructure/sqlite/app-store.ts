import {
  openSqliteDatabase,
  persistSqliteDatabase,
  sqliteDatabasePath,
  type SqliteDatabase
} from "./connection.js";
import { runMigrations } from "./migrations/index.js";
import { newAppMetadataRepository } from "../../domain/app-metadata/repository.js";
import { createEmptyDatabase } from "../../domain/app/factory.js";
import type { Database } from "../../domain/app/types.js";
import { createSessionAggregate, createSessionFromAggregate } from "../../domain/session/factory.js";
import { newSessionRepository } from "../../domain/session/repository.js";
import type { SessionAggregate } from "../../domain/session/types.js";
import { createDefaultSettings } from "../../domain/setting/factory.js";
import { newSettingRepository } from "../../domain/setting/repository.js";
import type { Settings } from "../../domain/setting/types.js";
import { newStimulationSetRepository } from "../../domain/stimulation-set/repository.js";
import type { StimulationSet } from "../../domain/stimulation-set/entity.js";
import { newTargetRepository } from "../../domain/target/repository.js";

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
    newSessionRepository(db).replaceAll(database.sessions.map(createSessionFromAggregate));
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

  return newSessionRepository(db)
    .all()
    .map((session) => createSessionAggregate(session, setsBySession.get(session.id) ?? []));
}

function readSettings(db: SqliteDatabase): Settings {
  const bilateralStimulation = newSettingRepository(db).find("bilateralStimulation");

  return {
    ...createDefaultSettings(),
    ...(bilateralStimulation ? { bilateralStimulation: JSON.parse(bilateralStimulation.valueJson) } : {})
  };
}
