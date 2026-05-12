import {
  createSqliteDatabase,
  exportSqliteDatabase,
  type SqliteDatabase
} from "./connection.js";
import { VaultService, type VaultStatus } from "../../../../../../domain/vault/service.js";
import { runMigrations } from "./migrations/index.js";
import { createEmptyDatabase } from "../../../../../../domain/app/factory.js";
import type { Database } from "../../../../../../domain/app/types.js";
import { createSessionAggregate, createSessionFromAggregate } from "../../../../../../domain/session/factory.js";
import { newSessionRepository } from "../../../../../../domain/session/repository.js";
import type { SessionAggregate } from "../../../../../../domain/session/types.js";
import { createDefaultSettings } from "../../../../../../domain/setting/factory.js";
import { newSettingRepository } from "../../../../../../domain/setting/repository.js";
import type { Settings } from "../../../../../../domain/setting/types.js";
import { newStimulationSetRepository } from "../../../../../../domain/stimulation-set/repository.js";
import type { StimulationSet } from "../../../../../../domain/stimulation-set/entity.js";
import { newTargetRepository } from "../../../../../../domain/target/repository.js";

let databasePromise: Promise<SqliteDatabase> | undefined;
let activePath: string | undefined;
let activeDataKey: Buffer | undefined;

export function appVaultStatus(userDataPath: string): VaultStatus {
  if (activePath === userDataPath && databasePromise && activeDataKey) return "unlocked";
  return new VaultService(userDataPath).exists() ? "locked" : "setupRequired";
}

export async function createAppVault(userDataPath: string, password: string) {
  const db = await createInitializedDatabase();
  const { recoveryCode, dataKey } = await new VaultService(userDataPath).create(password, exportSqliteDatabase(db));
  setActiveDatabase(userDataPath, db, dataKey);
  return { recoveryCode };
}

export async function unlockAppVaultWithPassword(userDataPath: string, password: string) {
  const unlocked = await new VaultService(userDataPath).unlockWithPassword(password);
  setActiveDatabase(userDataPath, await openDatabaseFromBytes(unlocked.plaintext), unlocked.dataKey);
}

export async function unlockAppVaultWithRecoveryCode(userDataPath: string, recoveryCode: string) {
  const unlocked = await new VaultService(userDataPath).unlockWithRecoveryCode(recoveryCode);
  setActiveDatabase(userDataPath, await openDatabaseFromBytes(unlocked.plaintext), unlocked.dataKey);
}

export async function loadAppDatabase(userDataPath: string): Promise<Database> {
  const db = await openDatabase(userDataPath);
  return readAppDatabase(db);
}

export async function saveAppDatabase(userDataPath: string, database: Database) {
  const db = await openDatabase(userDataPath);
  writeAppDatabase(db, database);
  await saveActiveDatabase(userDataPath, db);
}

export async function exportAppVault(userDataPath: string, destinationPath: string) {
  await new VaultService(userDataPath).export(destinationPath);
}

export async function importAppVault(userDataPath: string, sourcePath: string) {
  await new VaultService(userDataPath).import(sourcePath);
  lockActiveDatabase(userDataPath);
}

async function openDatabase(userDataPath: string) {
  if (databasePromise && activePath === userDataPath && activeDataKey) {
    return databasePromise;
  }

  throw new Error("Encrypted data is locked.");
}

async function createInitializedDatabase() {
  const db = await createSqliteDatabase();
  runMigrations(db);
  writeAppDatabase(db, createEmptyDatabase());
  return db;
}

async function openDatabaseFromBytes(bytes: Buffer) {
  const db = await createSqliteDatabase(bytes);
  runMigrations(db);
  return db;
}

function setActiveDatabase(userDataPath: string, db: SqliteDatabase, dataKey: Buffer) {
  activePath = userDataPath;
  activeDataKey = dataKey;
  databasePromise = Promise.resolve(db);
}

function lockActiveDatabase(userDataPath: string) {
  if (activePath !== userDataPath) return;
  activePath = undefined;
  activeDataKey = undefined;
  databasePromise = undefined;
}

async function saveActiveDatabase(userDataPath: string, db: SqliteDatabase) {
  if (!activeDataKey || activePath !== userDataPath) {
    throw new Error("Encrypted data is locked.");
  }

  await new VaultService(userDataPath).save(activeDataKey, exportSqliteDatabase(db));
}

function readAppDatabase(db: SqliteDatabase): Database {
  return {
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
