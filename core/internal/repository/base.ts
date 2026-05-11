import type { SqlValue } from "sql.js";
import type { SqliteDatabase } from "../sqlite/connection.js";
import { selectAll, selectOne } from "../sqlite/connection.js";
import type { ListOptions, SQLBaseRepositoryOptions, SqliteRow } from "./types.js";
import { camelToSnake, fromSqlValue, quoteIdentifier, snakeToCamel, toSqlValue } from "./utils.js";

export class SQLBaseRepository<T extends object> {
  private columns: string[] | undefined;

  constructor(
    private readonly db: SqliteDatabase,
    private readonly table: string,
    private readonly options: SQLBaseRepositoryOptions = {}
  ) {}

  all(options?: ListOptions): T[] {
    const orderBy = this.options.orderBy ? ` ORDER BY ${this.options.orderBy}` : "";
    let sql = `SELECT * FROM ${quoteIdentifier(this.table)}${orderBy}`;
    const params: SqlValue[] = [];
    if (options?.limit !== undefined) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }
    if (options?.offset !== undefined) {
      sql += " OFFSET ?";
      params.push(options.offset);
    }
    return selectAll(this.db, sql, params).map((row) => this.fromRow(row));
  }

  find(primaryKey: string): T | undefined {
    const row = selectOne(this.db, `SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${this.primaryKeyColumn()} = ?`, [
      primaryKey
    ]);
    return row ? this.fromRow(row) : undefined;
  }

  findBy(column: keyof T & string, value: SqlValue): T[] {
    const snakeColumn = camelToSnake(column);
    const orderBy = this.options.orderBy ? ` ORDER BY ${this.options.orderBy}` : "";
    return selectAll(
      this.db,
      `SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${quoteIdentifier(snakeColumn)} = ?${orderBy}`,
      [value]
    ).map((row) => this.fromRow(row));
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

  update(primaryKey: string, patch: Partial<T>) {
    const row = this.toRow(patch as T);
    const entries = Object.entries(row).filter(([key]) => this.tableColumns().includes(key));
    if (entries.length === 0) return;
    const setClause = entries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(", ");
    this.db.run(
      `UPDATE ${quoteIdentifier(this.table)} SET ${setClause} WHERE ${this.primaryKeyColumn()} = ?`,
      [...entries.map(([, value]) => value ?? null), primaryKey]
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
