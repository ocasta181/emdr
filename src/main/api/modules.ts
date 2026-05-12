import { GuideRoutes } from "../internal/domain/guide/module.js";
import { GuideService } from "../internal/domain/guide/service.js";
import { SessionRoutes } from "../internal/domain/session/module.js";
import { newSessionRepository } from "../internal/domain/session/repository.js";
import { SessionService } from "../internal/domain/session/service.js";
import { SettingRoutes } from "../internal/domain/setting/module.js";
import { newSettingRepository } from "../internal/domain/setting/repository.js";
import { SettingService } from "../internal/domain/setting/service.js";
import { StimulationSetRoutes } from "../internal/domain/stimulation-set/module.js";
import { newStimulationSetRepository } from "../internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import { TargetRoutes } from "../internal/domain/target/module.js";
import { newTargetRepository } from "../internal/domain/target/repository.js";
import { TargetService } from "../internal/domain/target/service.js";
import { VaultRoutes } from "../internal/domain/vault/module.js";
import { VaultApplicationService, VaultService } from "../internal/domain/vault/service.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { AppStoreDatabase } from "../internal/lib/store/sqlite/app-store.js";
import type { InitializeOptions, MainModule } from "./types.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const routes = options.routes;
  const userDataPath = options.getUserDataPath;

  const db = new AppStoreDatabase(userDataPath());

  const targetRepository = newTargetRepository(db);
  const sessionRepository = newSessionRepository(db);
  const settingRepository = newSettingRepository(db);
  const stimulationSetRepository = newStimulationSetRepository(db);
  const vaultFileService = new VaultService(userDataPath());

  const targetService = new TargetService(targetRepository);
  const sessionLookupService = new SessionService(sessionRepository);
  const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
  const sessionService = new SessionService(sessionRepository, stimulationSetService);
  const settingService = new SettingService(settingRepository);
  const guideService = new GuideService(targetService, sessionService, stimulationSetService);
  const vaultService = new VaultApplicationService(db, vaultFileService, createVaultFileDialogs());

  const vaultRoutes = new VaultRoutes(routes, vaultService);
  const targetRoutes = new TargetRoutes(routes, targetService);
  const sessionRoutes = new SessionRoutes(routes, sessionService, targetService);
  const settingRoutes = new SettingRoutes(routes, settingService);
  const stimulationSetRoutes = new StimulationSetRoutes(routes, stimulationSetService);
  const guideRoutes = new GuideRoutes(routes, guideService);

  return [vaultRoutes, targetRoutes, sessionRoutes, settingRoutes, stimulationSetRoutes, guideRoutes];
}
