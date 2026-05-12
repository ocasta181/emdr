import { readFile } from "node:fs/promises";
import type { BindParams, Statement } from "sql.js";
import { VaultService, type VaultStatus } from "../../../domain/vault/service.js";
import { createSqliteDatabase, exportSqliteDatabase, type SqliteDatabase } from "./connection.js";

export class AppStoreDatabase implements SqliteDatabase {
  private db: SqliteDatabase | undefined;
  private dataKey: Buffer | undefined;
  private transactionDepth = 0;
  private transactionDirty = false;

  constructor(private readonly userDataPath: string) {}

  status(): VaultStatus {
    if (this.db && this.dataKey) return "unlocked";
    return new VaultService(this.userDataPath).exists() ? "locked" : "setupRequired";
  }

  async create(password: string) {
    const templatePath = process.env.EMDR_SQLITE_TEMPLATE_PATH;
    if (!templatePath) {
      throw new Error("EMDR_SQLITE_TEMPLATE_PATH must point to a migrated SQLite database template.");
    }

    const db = await createSqliteDatabase(await readFile(templatePath));
    const { recoveryCode, dataKey } = await new VaultService(this.userDataPath).create(
      password,
      exportSqliteDatabase(db)
    );
    this.unlock(db, dataKey);
    return { recoveryCode };
  }

  async unlockWithPassword(password: string) {
    const unlocked = await new VaultService(this.userDataPath).unlockWithPassword(password);
    this.unlock(await createSqliteDatabase(unlocked.plaintext), unlocked.dataKey);
  }

  async unlockWithRecoveryCode(recoveryCode: string) {
    const unlocked = await new VaultService(this.userDataPath).unlockWithRecoveryCode(recoveryCode);
    this.unlock(await createSqliteDatabase(unlocked.plaintext), unlocked.dataKey);
  }

  lock() {
    this.db = undefined;
    this.dataKey = undefined;
    this.transactionDepth = 0;
    this.transactionDirty = false;
  }

  prepare(sql: string, params?: BindParams): Statement {
    return this.unlockedDatabase().prepare(sql, params);
  }

  run(sql: string, params?: BindParams): SqliteDatabase {
    const db = this.unlockedDatabase();
    db.run(sql, params);
    this.afterRun(sql);
    return this;
  }

  export(): Uint8Array {
    return this.unlockedDatabase().export();
  }

  private unlock(db: SqliteDatabase, dataKey: Buffer) {
    this.db = db;
    this.dataKey = dataKey;
    this.transactionDepth = 0;
    this.transactionDirty = false;
  }

  private unlockedDatabase() {
    if (!this.db || !this.dataKey) {
      throw new Error("Encrypted data is locked.");
    }

    return this.db;
  }

  private afterRun(sql: string) {
    const statement = firstStatementKeyword(sql);
    if (!statement) return;

    if (statement === "BEGIN") {
      this.transactionDepth += 1;
      return;
    }

    if (statement === "ROLLBACK") {
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);
      this.transactionDirty = false;
      return;
    }

    if (statement === "COMMIT") {
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);
      if (this.transactionDepth === 0 && this.transactionDirty) {
        this.save();
        this.transactionDirty = false;
      }
      return;
    }

    if (!isWriteStatement(statement)) return;

    if (this.transactionDepth > 0) {
      this.transactionDirty = true;
      return;
    }

    this.save();
  }

  private save() {
    if (!this.db || !this.dataKey) {
      throw new Error("Encrypted data is locked.");
    }

    new VaultService(this.userDataPath).saveSync(this.dataKey, exportSqliteDatabase(this.db));
  }
}

function firstStatementKeyword(sql: string) {
  return sql
    .trimStart()
    .replace(/^--.*(?:\r?\n|$)/, "")
    .trimStart()
    .match(/^[a-z]+/i)?.[0]
    .toUpperCase();
}

function isWriteStatement(statement: string) {
  return ["INSERT", "UPDATE", "DELETE", "REPLACE", "CREATE", "ALTER", "DROP"].includes(statement);
}
