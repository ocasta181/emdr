import type { SessionService } from "../internal/domain/session/service.js";
import type { SettingService } from "../internal/domain/setting/service.js";
import type { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import type { TargetService } from "../internal/domain/target/service.js";
import type { SqliteDatabase } from "../internal/lib/store/sqlite/connection.js";

export type DomainServices = {
  targets: TargetService;
  sessions: SessionService;
  settings: SettingService;
  stimulationSets: StimulationSetService;
};

export type CreateDomainServices = (db: SqliteDatabase) => DomainServices;
