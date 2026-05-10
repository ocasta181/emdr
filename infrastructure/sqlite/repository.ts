import type { SqlValue } from "sql.js";
import type { SqliteDatabase } from "./database.js";
import { selectAll, selectOne } from "./database.js";

type SqliteRow = Record<string, SqlValue>;

export type RepositoryMapper<T> = {
  tableName: string;
  primaryKey: string;
  columns: string[];
  orderBy?: string;
  toRow: (entity: T) => SqliteRow;
  fromRow: (row: Record<string, unknown>) => T;
};

export type Repository<T> = {
  all: () => T[];
  find: (primaryKey: string) => T | undefined;
  insert: (entity: T) => void;
  replaceAll: (entities: T[]) => void;
  delete: (primaryKey: string) => void;
  deleteAll: () => void;
};

export type SQLBaseRepositoryOptions = {
  primaryKey?: string;
  orderBy?: string;
};

export class SQLBaseRepository<T extends object> {
  private columns: string[] | undefined;

  constructor(
    private readonly db: SqliteDatabase,
    private readonly table: string,
    private readonly options: SQLBaseRepositoryOptions = {}
  ) {}

  all(): T[] {
    const orderBy = this.options.orderBy ? ` ORDER BY ${this.options.orderBy}` : "";
    return selectAll(this.db, `SELECT * FROM ${quoteIdentifier(this.table)}${orderBy}`).map((row) => this.fromRow(row));
  }

  find(primaryKey: string): T | undefined {
    const row = selectOne(this.db, `SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${this.primaryKeyColumn()} = ?`, [
      primaryKey
    ]);
    return row ? this.fromRow(row) : undefined;
  }

  insert(entity: T) {
    const row = this.toRow(entity);
    const columns = this.tableColumns();
    const columnList = columns.map(quoteIdentifier).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    this.db.run(
      `INSERT INTO ${quoteIdentifier(this.table)} (${columnList}) VALUES (${placeholders})`,
      columns.map((column) => row[column] ?? null)
    );
  }

  replaceAll(entities: T[]) {
    this.deleteAll();
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  delete(primaryKey: string) {
    this.db.run(`DELETE FROM ${quoteIdentifier(this.table)} WHERE ${this.primaryKeyColumn()} = ?`, [primaryKey]);
  }

  deleteAll() {
    this.db.run(`DELETE FROM ${quoteIdentifier(this.table)}`);
  }

  private primaryKeyColumn() {
    return quoteIdentifier(this.options.primaryKey ?? "id");
  }

  private tableColumns() {
    this.columns ??= selectAll(this.db, `PRAGMA table_info(${quoteIdentifier(this.table)})`).map((row) =>
      String(row.name)
    );
    return this.columns;
  }

  private toRow(entity: T): SqliteRow {
    return Object.fromEntries(
      Object.entries(entity).map(([key, value]) => [camelToSnake(key), toSqlValue(value)])
    ) as SqliteRow;
  }

  private fromRow(row: Record<string, unknown>): T {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [snakeToCamel(key), fromSqlValue(key, value)])
    ) as T;
  }
}

export function createRepository<T>(
  db: SqliteDatabase,
  mapper: RepositoryMapper<T>
): Repository<T> {
  const tableName = quoteIdentifier(mapper.tableName);
  const primaryKeyColumn = quoteIdentifier(mapper.primaryKey);
  const columns = mapper.columns.map(quoteIdentifier).join(", ");
  const placeholders = mapper.columns.map(() => "?").join(", ");

  return {
    all() {
      const orderBy = mapper.orderBy ? ` ORDER BY ${mapper.orderBy}` : "";
      return selectAll(db, `SELECT * FROM ${tableName}${orderBy}`).map(mapper.fromRow);
    },

    find(primaryKey: string) {
      const row = selectOne(db, `SELECT * FROM ${tableName} WHERE ${primaryKeyColumn} = ?`, [primaryKey]);
      return row ? mapper.fromRow(row) : undefined;
    },

    insert(entity: T) {
      const row = mapper.toRow(entity);
      db.run(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, mapper.columns.map((column) => row[column]));
    },

    replaceAll(entities: T[]) {
      this.deleteAll();
      for (const entity of entities) {
        this.insert(entity);
      }
    },

    delete(primaryKey: string) {
      db.run(`DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ?`, [primaryKey]);
    },

    deleteAll() {
      db.run(`DELETE FROM ${tableName}`);
    }
  };
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQLite identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function toSqlValue(value: unknown): SqlValue {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value as SqlValue;
}

function fromSqlValue(column: string, value: unknown) {
  if (value === null) return undefined;
  if (column.startsWith("is_") && typeof value === "number") return value === 1;
  return value;
}
