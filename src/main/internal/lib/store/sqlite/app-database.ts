import { createEmptyDatabase } from "../../../domain/app/factory.js";
import type { Database } from "../../../domain/app/types.js";
import { createSessionAggregate, createSessionFromAggregate } from "../../../domain/session/factory.js";
import { newSessionRepository } from "../../../domain/session/repository.js";
import type { SessionAggregate } from "../../../domain/session/types.js";
import { createDefaultSettings } from "../../../domain/setting/factory.js";
import { newSettingRepository } from "../../../domain/setting/repository.js";
import type { Settings } from "../../../domain/setting/types.js";
import { newStimulationSetRepository } from "../../../domain/stimulation-set/repository.js";
import type { StimulationSet } from "../../../domain/stimulation-set/entity.js";
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

export function readAppDatabase(db: SqliteDatabase): Database {
  return {
    targets: newTargetRepository(db).all(),
    sessions: readSessionAggregates(db),
    settings: readSettings(db)
  };
}

export function writeAppDatabase(db: SqliteDatabase, database: Database) {
  newTargetRepository(db).replaceAll(database.targets);
  newSessionRepository(db).replaceAll(database.sessions.map(createSessionFromAggregate));
  newStimulationSetRepository(db).replaceAll(database.sessions.flatMap((session) => session.stimulationSets));
  newSettingRepository(db).replaceAll([
    { key: "bilateralStimulation", valueJson: JSON.stringify(database.settings.bilateralStimulation) }
  ]);
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
