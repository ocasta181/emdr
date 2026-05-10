import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  legacyJsonDatabasePath,
  numberValue,
  openSqliteDatabase,
  optionalNumber,
  optionalString,
  persistSqliteDatabase,
  selectAll,
  selectOne,
  sqliteDatabasePath,
  stringValue,
  type SqliteDatabase
} from "./infrastructure/sqlite/database.js";

type TargetStatus = "active" | "completed" | "deferred";

type TargetVersion = {
  id: string;
  rootTargetId: string;
  parentVersionId?: string;
  isHead: boolean;
  createdAt: string;
  updatedAt: string;
  description: string;
  negativeCognition: string;
  positiveCognition: string;
  clusterTag?: string;
  initialSud?: number;
  currentSud?: number;
  status: TargetStatus;
  notes?: string;
};

type Assessment = {
  image?: string;
  negativeCognition: string;
  positiveCognition: string;
  validityOfCognition?: number;
  emotions?: string;
  subjectiveUnitsOfDisturbance?: number;
  bodyLocation?: string;
};

type StimulationSet = {
  id: string;
  sessionId: string;
  setNumber: number;
  createdAt: string;
  cycleCount: number;
  observation: string;
  subjectiveUnitsOfDisturbance?: number;
};

type Session = {
  id: string;
  targetRootId: string;
  targetVersionId: string;
  startedAt: string;
  endedAt?: string;
  assessment: Assessment;
  stimulationSets: StimulationSet[];
  finalSud?: number;
  notes?: string;
};

type AppDatabase = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: TargetVersion[];
  sessions: Session[];
  settings: {
    bilateralStimulation: {
      speed: number;
      dotSize: "small" | "medium" | "large";
      dotColor: "green" | "blue" | "white" | "orange";
    };
  };
};

let databasePromise: Promise<SqliteDatabase> | undefined;
let activePath: string | undefined;

export async function loadAppDatabase(userDataPath: string): Promise<AppDatabase> {
  const db = await openDatabase(userDataPath);
  return readAppDatabase(db);
}

export async function saveAppDatabase(userDataPath: string, database: AppDatabase) {
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
  ensureSchema(db);

  if (selectAll(db, "SELECT key FROM app_metadata LIMIT 1").length === 0) {
    const legacyPath = legacyJsonDatabasePath(userDataPath);
    if (existsSync(legacyPath)) {
      const legacy = JSON.parse(await readFile(legacyPath, "utf8")) as AppDatabase;
      writeAppDatabase(db, legacy);
    } else {
      writeAppDatabase(db, createEmptyDatabase());
    }

    await persistSqliteDatabase(db, sqlitePath);
  }

  return db;
}

function ensureSchema(db: SqliteDatabase) {
  db.run(`
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = 1;

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS target_versions (
      id TEXT PRIMARY KEY,
      root_target_id TEXT NOT NULL,
      parent_version_id TEXT,
      is_head INTEGER NOT NULL CHECK (is_head IN (0, 1)),
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

    CREATE INDEX IF NOT EXISTS idx_target_versions_root ON target_versions(root_target_id);
    CREATE INDEX IF NOT EXISTS idx_target_versions_head ON target_versions(is_head, status, current_disturbance);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      target_root_id TEXT NOT NULL,
      target_version_id TEXT NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_sessions_target ON sessions(target_root_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

    CREATE TABLE IF NOT EXISTS stimulation_sets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      cycle_count INTEGER NOT NULL,
      observation TEXT NOT NULL,
      disturbance REAL,
      UNIQUE(session_id, set_number)
    );

    CREATE INDEX IF NOT EXISTS idx_stimulation_sets_session ON stimulation_sets(session_id, set_number);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
}

function readAppDatabase(db: SqliteDatabase): AppDatabase {
  const createdAt = readMetadata(db, "createdAt") ?? new Date().toISOString();
  const updatedAt = readMetadata(db, "updatedAt") ?? createdAt;
  const settings = readSettings(db);

  return {
    schemaVersion: 1,
    createdAt,
    updatedAt,
    targets: selectAll(db, "SELECT * FROM target_versions ORDER BY created_at ASC").map(readTarget),
    sessions: readSessions(db),
    settings
  };
}

function writeAppDatabase(db: SqliteDatabase, database: AppDatabase) {
  db.run("BEGIN TRANSACTION");

  try {
    db.run("DELETE FROM stimulation_sets");
    db.run("DELETE FROM sessions");
    db.run("DELETE FROM target_versions");
    db.run("DELETE FROM settings");
    db.run("DELETE FROM app_metadata");

    insertMetadata(db, "schemaVersion", String(database.schemaVersion));
    insertMetadata(db, "createdAt", database.createdAt);
    insertMetadata(db, "updatedAt", database.updatedAt);
    insertSetting(db, "bilateralStimulation", database.settings.bilateralStimulation);

    const targetStatement = db.prepare(`
      INSERT INTO target_versions (
        id,
        root_target_id,
        parent_version_id,
        is_head,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const target of database.targets) {
      targetStatement.run([
        target.id,
        target.rootTargetId,
        target.parentVersionId ?? null,
        target.isHead ? 1 : 0,
        target.createdAt,
        target.updatedAt,
        target.description,
        target.negativeCognition,
        target.positiveCognition,
        target.clusterTag ?? null,
        target.initialSud ?? null,
        target.currentSud ?? null,
        target.status,
        target.notes ?? null
      ]);
    }
    targetStatement.free();

    const sessionStatement = db.prepare(`
      INSERT INTO sessions (
        id,
        target_root_id,
        target_version_id,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const setStatement = db.prepare(`
      INSERT INTO stimulation_sets (
        id,
        session_id,
        set_number,
        created_at,
        cycle_count,
        observation,
        disturbance
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const session of database.sessions) {
      sessionStatement.run([
        session.id,
        session.targetRootId,
        session.targetVersionId,
        session.startedAt,
        session.endedAt ?? null,
        session.assessment.image ?? null,
        session.assessment.negativeCognition,
        session.assessment.positiveCognition,
        session.assessment.validityOfCognition ?? null,
        session.assessment.emotions ?? null,
        session.assessment.subjectiveUnitsOfDisturbance ?? null,
        session.assessment.bodyLocation ?? null,
        session.finalSud ?? null,
        session.notes ?? null
      ]);

      for (const set of session.stimulationSets) {
        setStatement.run([
          set.id,
          session.id,
          set.setNumber,
          set.createdAt,
          set.cycleCount,
          set.observation,
          set.subjectiveUnitsOfDisturbance ?? null
        ]);
      }
    }
    sessionStatement.free();
    setStatement.free();

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

function readSessions(db: SqliteDatabase): Session[] {
  const setsBySession = new Map<string, StimulationSet[]>();
  for (const row of selectAll(db, "SELECT * FROM stimulation_sets ORDER BY session_id ASC, set_number ASC")) {
    const set = readStimulationSet(row);
    const sets = setsBySession.get(set.sessionId) ?? [];
    sets.push(set);
    setsBySession.set(set.sessionId, sets);
  }

  return selectAll(db, "SELECT * FROM sessions ORDER BY started_at ASC").map((row) => readSession(row, setsBySession));
}

function readTarget(row: Record<string, unknown>): TargetVersion {
  return {
    id: stringValue(row.id),
    rootTargetId: stringValue(row.root_target_id),
    parentVersionId: optionalString(row.parent_version_id),
    isHead: numberValue(row.is_head) === 1,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    description: stringValue(row.description),
    negativeCognition: stringValue(row.negative_cognition),
    positiveCognition: stringValue(row.positive_cognition),
    clusterTag: optionalString(row.cluster_tag),
    initialSud: optionalNumber(row.initial_disturbance),
    currentSud: optionalNumber(row.current_disturbance),
    status: stringValue(row.status) as TargetStatus,
    notes: optionalString(row.notes)
  };
}

function readSession(row: Record<string, unknown>, setsBySession: Map<string, StimulationSet[]>): Session {
  const id = stringValue(row.id);
  return {
    id,
    targetRootId: stringValue(row.target_root_id),
    targetVersionId: stringValue(row.target_version_id),
    startedAt: stringValue(row.started_at),
    endedAt: optionalString(row.ended_at),
    assessment: {
      image: optionalString(row.assessment_image),
      negativeCognition: stringValue(row.assessment_negative_cognition),
      positiveCognition: stringValue(row.assessment_positive_cognition),
      validityOfCognition: optionalNumber(row.assessment_believability),
      emotions: optionalString(row.assessment_emotions),
      subjectiveUnitsOfDisturbance: optionalNumber(row.assessment_disturbance),
      bodyLocation: optionalString(row.assessment_body_location)
    },
    stimulationSets: setsBySession.get(id) ?? [],
    finalSud: optionalNumber(row.final_disturbance),
    notes: optionalString(row.notes)
  };
}

function readStimulationSet(row: Record<string, unknown>): StimulationSet {
  return {
    id: stringValue(row.id),
    sessionId: stringValue(row.session_id),
    setNumber: numberValue(row.set_number),
    createdAt: stringValue(row.created_at),
    cycleCount: numberValue(row.cycle_count),
    observation: stringValue(row.observation),
    subjectiveUnitsOfDisturbance: optionalNumber(row.disturbance)
  };
}

function readMetadata(db: SqliteDatabase, key: string) {
  const row = selectOne(db, "SELECT value FROM app_metadata WHERE key = ?", [key]);
  return row ? stringValue(row.value) : undefined;
}

function insertMetadata(db: SqliteDatabase, key: string, value: string) {
  db.run("INSERT INTO app_metadata (key, value) VALUES (?, ?)", [key, value]);
}

function readSettings(db: SqliteDatabase): AppDatabase["settings"] {
  const row = selectOne(db, "SELECT value_json FROM settings WHERE key = ?", ["bilateralStimulation"]);
  return {
    bilateralStimulation: row
      ? (JSON.parse(stringValue(row.value_json)) as AppDatabase["settings"]["bilateralStimulation"])
      : createEmptyDatabase().settings.bilateralStimulation
  };
}

function insertSetting(db: SqliteDatabase, key: string, value: unknown) {
  db.run("INSERT INTO settings (key, value_json) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

function createEmptyDatabase(): AppDatabase {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    targets: [],
    sessions: [],
    settings: {
      bilateralStimulation: {
        speed: 1,
        dotSize: "medium",
        dotColor: "green"
      }
    }
  };
}
