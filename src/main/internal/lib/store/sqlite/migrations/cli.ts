import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { memoryStorage, Umzug } from "umzug";
import { createSqliteDatabase, exportSqliteDatabase } from "../connection.js";
import type { SqliteDatabase } from "../connection.js";
import { up as initialSchema } from "./0001_initial_schema.js";

async function main() {
  const databasePath = databasePathFromArgs(process.argv.slice(2));
  const db = await createSqliteDatabase(await readExistingDatabase(databasePath));
  const migrator = new Umzug<SqliteDatabase>({
    context: db,
    logger: undefined,
    storage: memoryStorage(),
    migrations: [
      {
        name: "0001_initial_schema",
        async up({ context }) {
          initialSchema(context);
        }
      }
    ]
  });

  await migrator.up();
  await mkdir(path.dirname(databasePath), { recursive: true });
  await writeFile(databasePath, exportSqliteDatabase(db));
  console.log(`Migrated SQLite database at ${databasePath}`);
}

function databasePathFromArgs(args: string[]) {
  const databaseFlagIndex = args.findIndex((arg) => arg === "--database" || arg === "--db");
  const databasePath = databaseFlagIndex >= 0 ? args[databaseFlagIndex + 1] : args[0];

  if (!databasePath) {
    throw new Error("Usage: pnpm migrate:sqlite -- --database <path>");
  }

  return path.resolve(databasePath);
}

async function readExistingDatabase(databasePath: string) {
  try {
    return await readFile(databasePath);
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
