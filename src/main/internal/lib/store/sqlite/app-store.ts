import { VaultService, type VaultStatus } from "../../../domain/vault/service.js";
import type { Database } from "../../../domain/app/types.js";
import { createInitializedAppDatabase, openMigratedAppDatabase, readAppDatabase, writeAppDatabase } from "./app-database.js";
import { exportSqliteDatabase, type SqliteDatabase } from "./connection.js";
import { runSqliteTransaction } from "./transaction.js";

let databasePromise: Promise<SqliteDatabase> | undefined;
let activePath: string | undefined;
let activeDataKey: Buffer | undefined;

export function appVaultStatus(userDataPath: string): VaultStatus {
  if (activePath === userDataPath && databasePromise && activeDataKey) return "unlocked";
  return new VaultService(userDataPath).exists() ? "locked" : "setupRequired";
}

export async function createAppVault(userDataPath: string, password: string) {
  const db = await createInitializedAppDatabase();
  const { recoveryCode, dataKey } = await new VaultService(userDataPath).create(password, exportSqliteDatabase(db));
  setActiveDatabase(userDataPath, db, dataKey);
  return { recoveryCode };
}

export async function unlockAppVaultWithPassword(userDataPath: string, password: string) {
  const unlocked = await new VaultService(userDataPath).unlockWithPassword(password);
  setActiveDatabase(userDataPath, await openMigratedAppDatabase(unlocked.plaintext), unlocked.dataKey);
}

export async function unlockAppVaultWithRecoveryCode(userDataPath: string, recoveryCode: string) {
  const unlocked = await new VaultService(userDataPath).unlockWithRecoveryCode(recoveryCode);
  setActiveDatabase(userDataPath, await openMigratedAppDatabase(unlocked.plaintext), unlocked.dataKey);
}

export async function loadAppDatabase(userDataPath: string): Promise<Database> {
  return readFromAppDatabase(userDataPath, readAppDatabase);
}

export async function saveAppDatabase(userDataPath: string, database: Database) {
  await mutateAppDatabase(userDataPath, (db) => writeAppDatabase(db, database));
}

export async function readFromAppDatabase<T>(userDataPath: string, reader: (db: SqliteDatabase) => T): Promise<T> {
  const db = await openDatabase(userDataPath);
  return reader(db);
}

export async function mutateAppDatabase<T>(userDataPath: string, mutator: (db: SqliteDatabase) => T): Promise<T> {
  const db = await openDatabase(userDataPath);
  const result = runSqliteTransaction(db, () => mutator(db));
  await saveActiveDatabase(userDataPath, db);
  return result;
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
