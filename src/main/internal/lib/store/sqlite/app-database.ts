import { createEmptyDatabase } from "../../../domain/app/factory.js";
import type { Database } from "../../../domain/app/types.js";
import { createSessionFromAggregate } from "../../../domain/session/factory.js";
import { newSessionRepository } from "../../../domain/session/repository.js";
import { newSettingRepository } from "../../../domain/setting/repository.js";
import { newStimulationSetRepository } from "../../../domain/stimulation-set/repository.js";
import { newTargetRepository } from "../../../domain/target/repository.js";
import { createSqliteDatabase, type SqliteDatabase } from "./connection.js";
import { runMigrations } from "./migrations/index.js";
import { runSqliteTransaction } from "./transaction.js";

export async function createInitializedAppDatabase() {
  const db = await createSqliteDatabase();
  runMigrations(db);
  runSqliteTransaction(db, () => writeAppDatabase(db, createEmptyDatabase()));
  return db;
}

export async function openMigratedAppDatabase(bytes: Buffer) {
  const db = await createSqliteDatabase(bytes);
  runMigrations(db);
  return db;
}

export function writeAppDatabase(db: SqliteDatabase, database: Database) {
  newTargetRepository(db).replaceAll(database.targets);
  newSessionRepository(db).replaceAll(database.sessions.map(createSessionFromAggregate));
  newStimulationSetRepository(db).replaceAll(database.sessions.flatMap((session) => session.stimulationSets));
  newSettingRepository(db).replaceAll([
    { key: "bilateralStimulation", valueJson: JSON.stringify(database.settings.bilateralStimulation) }
  ]);
}
