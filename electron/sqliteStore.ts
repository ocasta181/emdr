import initSqlJs from "sql.js";
import type { Database as SqlDatabase, SqlJsStatic } from "sql.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

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

type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  entityType?: "target" | "session" | "settings";
  entityId?: string;
  payload?: Record<string, unknown>;
};

type AppDatabase = {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  targets: TargetVersion[];
  sessions: Session[];
  activityEvents: ActivityEvent[];
  settings: {
    bilateralStimulation: {
      speed: number;
      dotSize: "small" | "medium" | "large";
      dotColor: "green" | "blue" | "white" | "orange";
    };
  };
};

const require = createRequire(import.meta.url);

let sqlPromise: Promise<SqlJsStatic> | undefined;
let databasePromise: Promise<SqlDatabase> | undefined;
let activePath: string | undefined;

export function sqliteDatabasePath(userDataPath: string) {
  return path.join(userDataPath, "emdr-local.sqlite");
}

export function legacyJsonDatabasePath(userDataPath: string) {
  return path.join(userDataPath, "emdr-local.db.json");
}

export async function loadAppDatabase(userDataPath: string): Promise<AppDatabase> {
  const db = await openDatabase(userDataPath);
  return readAppDatabase(db);
}

export async function saveAppDatabase(userDataPath: string, database: AppDatabase) {
  const db = await openDatabase(userDataPath);
  writeAppDatabase(db, database);
  await persistDatabase(db, sqliteDatabasePath(userDataPath));
}

async function loadSql() {
  sqlPromise ??= initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm")
  });
  return sqlPromise;
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
  const SQL = await loadSql();
  const sqlitePath = sqliteDatabasePath(userDataPath);
  await mkdir(path.dirname(sqlitePath), { recursive: true });

  const sqliteExists = existsSync(sqlitePath);
  const sqliteHasData = sqliteExists && (await stat(sqlitePath)).size > 0;
  const db = sqliteHasData ? new SQL.Database(await readFile(sqlitePath)) : new SQL.Database();
  ensureSchema(db);

  if (!sqliteHasData) {
    const legacyPath = legacyJsonDatabasePath(userDataPath);
    if (existsSync(legacyPath)) {
      const legacy = JSON.parse(await readFile(legacyPath, "utf8")) as AppDatabase;
      writeAppDatabase(db, legacy);
    } else {
      writeAppDatabase(db, createEmptyDatabase());
    }

    await persistDatabase(db, sqlitePath);
  }

  return db;
}

function ensureSchema(db: SqlDatabase) {
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

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      payload_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_activity_events_timestamp ON activity_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
}

function readAppDatabase(db: SqlDatabase): AppDatabase {
  const createdAt = readMetadata(db, "createdAt") ?? new Date().toISOString();
  const updatedAt = readMetadata(db, "updatedAt") ?? createdAt;
  const settings = readSettings(db);

  return {
    schemaVersion: 1,
    createdAt,
    updatedAt,
    targets: selectAll(db, "SELECT * FROM target_versions ORDER BY created_at ASC").map(readTarget),
    sessions: readSessions(db),
    activityEvents: selectAll(db, "SELECT * FROM activity_events ORDER BY timestamp ASC").map(readActivityEvent),
    settings
  };
}

function writeAppDatabase(db: SqlDatabase, database: AppDatabase) {
  db.run("BEGIN TRANSACTION");

  try {
    db.run("DELETE FROM stimulation_sets");
    db.run("DELETE FROM sessions");
    db.run("DELETE FROM target_versions");
    db.run("DELETE FROM activity_events");
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

    const eventStatement = db.prepare(`
      INSERT INTO activity_events (
        id,
        timestamp,
        type,
        entity_type,
        entity_id,
        payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const event of database.activityEvents) {
      eventStatement.run([
        event.id,
        event.timestamp,
        event.type,
        event.entityType ?? null,
        event.entityId ?? null,
        event.payload ? JSON.stringify(event.payload) : null
      ]);
    }
    eventStatement.free();

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

async function persistDatabase(db: SqlDatabase, sqlitePath: string) {
  const temporaryPath = `${sqlitePath}.tmp`;
  await writeFile(temporaryPath, Buffer.from(db.export()));
  await rename(temporaryPath, sqlitePath);
}

function readSessions(db: SqlDatabase): Session[] {
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

function readActivityEvent(row: Record<string, unknown>): ActivityEvent {
  return {
    id: stringValue(row.id),
    timestamp: stringValue(row.timestamp),
    type: stringValue(row.type),
    entityType: optionalString(row.entity_type) as ActivityEvent["entityType"],
    entityId: optionalString(row.entity_id),
    payload: parseJsonObject(optionalString(row.payload_json))
  };
}

function readMetadata(db: SqlDatabase, key: string) {
  const row = selectOne(db, "SELECT value FROM app_metadata WHERE key = ?", [key]);
  return row ? stringValue(row.value) : undefined;
}

function insertMetadata(db: SqlDatabase, key: string, value: string) {
  db.run("INSERT INTO app_metadata (key, value) VALUES (?, ?)", [key, value]);
}

function readSettings(db: SqlDatabase): AppDatabase["settings"] {
  const row = selectOne(db, "SELECT value_json FROM settings WHERE key = ?", ["bilateralStimulation"]);
  return {
    bilateralStimulation: row
      ? (JSON.parse(stringValue(row.value_json)) as AppDatabase["settings"]["bilateralStimulation"])
      : createEmptyDatabase().settings.bilateralStimulation
  };
}

function insertSetting(db: SqlDatabase, key: string, value: unknown) {
  db.run("INSERT INTO settings (key, value_json) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

function selectOne(db: SqlDatabase, sql: string, params: initSqlJs.BindParams = []) {
  const rows = selectAll(db, sql, params);
  return rows[0];
}

function selectAll(db: SqlDatabase, sql: string, params: initSqlJs.BindParams = []) {
  const statement = db.prepare(sql, params);
  const rows: Record<string, unknown>[] = [];

  try {
    while (statement.step()) {
      rows.push(statement.getAsObject() as Record<string, unknown>);
    }
  } finally {
    statement.free();
  }

  return rows;
}

function parseJsonObject(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return JSON.parse(value) as Record<string, unknown>;
}

function stringValue(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Expected SQLite text value.");
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  if (typeof value !== "number") {
    throw new Error("Expected SQLite numeric value.");
  }
  return value;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function createEmptyDatabase(): AppDatabase {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    targets: [],
    sessions: [],
    activityEvents: [],
    settings: {
      bilateralStimulation: {
        speed: 1,
        dotSize: "medium",
        dotColor: "green"
      }
    }
  };
}
