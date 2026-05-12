import { GuideRoutes } from "../internal/domain/guide/module.js";
import { SessionRoutes } from "../internal/domain/session/module.js";
import { newSessionRepository } from "../internal/domain/session/repository.js";
import { nextSessionFlowState, SessionService } from "../internal/domain/session/service.js";
import type { SessionIpcService } from "../internal/domain/session/types.js";
import { SettingRoutes } from "../internal/domain/setting/module.js";
import { newSettingRepository } from "../internal/domain/setting/repository.js";
import { SettingService } from "../internal/domain/setting/service.js";
import type { SettingIpcService } from "../internal/domain/setting/types.js";
import { StimulationSetRoutes } from "../internal/domain/stimulation-set/module.js";
import { newStimulationSetRepository } from "../internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import type { StimulationSetIpcService } from "../internal/domain/stimulation-set/types.js";
import { TargetRoutes } from "../internal/domain/target/module.js";
import { newTargetRepository } from "../internal/domain/target/repository.js";
import { TargetService } from "../internal/domain/target/service.js";
import type { TargetIpcService } from "../internal/domain/target/types.js";
import { VaultRoutes } from "../internal/domain/vault/module.js";
import { VaultService } from "../internal/domain/vault/service.js";
import type { VaultIpcService } from "../internal/domain/vault/types.js";
import { GuideService } from "../internal/domain/guide/service.js";
import type { GuideIpcService } from "../internal/domain/guide/types.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import {
  appVaultStatus,
  createAppVault,
  exportAppVault,
  importAppVault,
  mutateAppDatabase,
  readFromAppDatabase,
  unlockAppVaultWithPassword,
  unlockAppVaultWithRecoveryCode
} from "../internal/lib/store/sqlite/app-store.js";
import type { InitializeOptions, MainModule } from "./types.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const routes = options.routes;
  const userDataPath = options.getUserDataPath;
  const vaultDialogs = createVaultFileDialogs();

  const vaultService = {
    status() {
      return appVaultStatus(userDataPath());
    },

    create(password) {
      return createAppVault(userDataPath(), password);
    },

    async unlockWithPassword(password) {
      await unlockAppVaultWithPassword(userDataPath(), password);
      return { ok: true };
    },

    async unlockWithRecoveryCode(recoveryCode) {
      await unlockAppVaultWithRecoveryCode(userDataPath(), recoveryCode);
      return { ok: true };
    },

    async exportVault() {
      const vaultFileService = new VaultService(userDataPath());
      const destinationPath = await vaultDialogs.chooseExportPath(vaultFileService.defaultExportName());
      if (!destinationPath) return { canceled: true };

      await exportAppVault(userDataPath(), destinationPath);
      return { canceled: false, path: destinationPath };
    },

    async importVault() {
      const sourcePath = await vaultDialogs.chooseImportPath();
      if (!sourcePath) return { canceled: true };

      const confirmed = await vaultDialogs.confirmImportReplacement();
      if (!confirmed) return { canceled: true };

      await importAppVault(userDataPath(), sourcePath);
      return { canceled: false };
    }
  } satisfies VaultIpcService;

  const targetService = {
    listCurrentTargets() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);

        return targetDomainService.listCurrentTargets();
      });
    },

    listAllTargets() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);

        return targetDomainService.listAllTargets();
      });
    },

    addTarget(draft) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);

        return targetDomainService.addTarget(draft);
      });
    },

    reviseTarget(previousId, patch) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);

        return targetDomainService.reviseTarget(previousId, patch);
      });
    }
  } satisfies TargetIpcService;

  const sessionService = {
    listSessions() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionDomainService = new SessionService(sessionRepository, stimulationSetService);

        return sessionDomainService.listSessions();
      });
    },

    startSession(targetId) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);
        const sessionRepository = newSessionRepository(db);
        const sessionDomainService = new SessionService(sessionRepository);

        return sessionDomainService.startSession(targetDomainService.requireTarget(targetId));
      });
    },

    updateAssessment(sessionId, assessment) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionDomainService = new SessionService(sessionRepository, stimulationSetService);

        return sessionDomainService.updateAssessment(sessionId, assessment);
      });
    },

    nextSessionFlowState(state, action) {
      return nextSessionFlowState(state, action);
    },

    endSession(request) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionDomainService = new SessionService(sessionRepository, stimulationSetService);

        return sessionDomainService.endSession(request.sessionId, {
          finalDisturbance: request.finalDisturbance,
          notes: request.notes
        });
      });
    }
  } satisfies SessionIpcService;

  const settingService = {
    getSettings() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const settingRepository = newSettingRepository(db);
        const settingDomainService = new SettingService(settingRepository);

        return settingDomainService.getSettings();
      });
    },

    updateBilateralStimulationSettings(patch) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const settingRepository = newSettingRepository(db);
        const settingDomainService = new SettingService(settingRepository);

        return settingDomainService.updateBilateralStimulationSettings(patch);
      });
    }
  } satisfies SettingIpcService;

  const stimulationSetService = {
    listBySession(sessionId) {
      return readFromAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetDomainService = new StimulationSetService(stimulationSetRepository, sessionLookupService);

        return stimulationSetDomainService.listBySession(sessionId);
      });
    },

    logStimulationSet(draft) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetDomainService = new StimulationSetService(stimulationSetRepository, sessionLookupService);

        return stimulationSetDomainService.logStimulationSet(draft);
      });
    }
  } satisfies StimulationSetIpcService;

  const guideService = {
    getView(request) {
      return readFromAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetDomainService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionDomainService = new SessionService(sessionRepository, stimulationSetDomainService);
        const guideDomainService = new GuideService(
          targetDomainService,
          sessionDomainService,
          stimulationSetDomainService
        );

        return guideDomainService.getView(request);
      });
    },

    applyAction(proposal) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetDomainService = new TargetService(targetRepository);
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetDomainService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionDomainService = new SessionService(sessionRepository, stimulationSetDomainService);
        const guideDomainService = new GuideService(
          targetDomainService,
          sessionDomainService,
          stimulationSetDomainService
        );

        return guideDomainService.applyAction(proposal);
      });
    }
  } satisfies GuideIpcService;

  const vaultRoutes = new VaultRoutes(routes, vaultService);
  const targetRoutes = new TargetRoutes(routes, targetService);
  const sessionRoutes = new SessionRoutes(routes, sessionService);
  const settingRoutes = new SettingRoutes(routes, settingService);
  const stimulationSetRoutes = new StimulationSetRoutes(routes, stimulationSetService);
  const guideRoutes = new GuideRoutes(routes, guideService);

  return [vaultRoutes, targetRoutes, sessionRoutes, settingRoutes, stimulationSetRoutes, guideRoutes];
}
