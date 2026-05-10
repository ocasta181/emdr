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
