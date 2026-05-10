import type { SqliteDatabase } from "../../infrastructure/sqlite/connection.js";
import { SQLBaseRepository } from "../../infrastructure/sqlite/repository.js";
import type { AppMetadata } from "./entity.js";

export const newAppMetadataRepository = (db: SqliteDatabase) =>
  new SQLBaseRepository<AppMetadata>(db, "app_metadata", { primaryKey: "key" });
