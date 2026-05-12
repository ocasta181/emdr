import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { createGuideModule } from "../internal/domain/guide/module.js";
import { GuideService } from "../internal/domain/guide/service.js";
import type { GuideIpcService } from "../internal/domain/guide/types.js";
import { createVaultModule } from "../internal/domain/vault/module.js";
import type { VaultIpcService } from "../internal/domain/vault/types.js";
import { createTargetModule } from "../internal/domain/target/module.js";
import { createSettingModule } from "../internal/domain/setting/module.js";
import { createStimulationSetModule } from "../internal/domain/stimulation-set/module.js";
import { createSessionModule } from "../internal/domain/session/module.js";
import { newSessionRepository } from "../internal/domain/session/repository.js";
import { nextSessionFlowState, SessionService } from "../internal/domain/session/service.js";
import type { SessionIpcService } from "../internal/domain/session/types.js";
import { newSettingRepository } from "../internal/domain/setting/repository.js";
import { SettingService } from "../internal/domain/setting/service.js";
import type { SettingIpcService } from "../internal/domain/setting/types.js";
import { newStimulationSetRepository } from "../internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import type { StimulationSetIpcService } from "../internal/domain/stimulation-set/types.js";
import { newTargetRepository } from "../internal/domain/target/repository.js";
import { TargetService } from "../internal/domain/target/service.js";
import type { TargetIpcService } from "../internal/domain/target/types.js";
import { VaultService } from "../internal/domain/vault/service.js";
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
  const userDataPath = options.getUserDataPath;
  const vaultDialogs = createVaultFileDialogs();

  const vaultIpcService = {
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
      const vaultService = new VaultService(userDataPath());
      const destinationPath = await vaultDialogs.chooseExportPath(vaultService.defaultExportName());
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
  const vaultModule = createVaultModule(vaultIpcService);

  const targetIpcService = {
    listCurrentTargets() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);

        return targetService.listCurrentTargets();
      });
    },

    listAllTargets() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);

        return targetService.listAllTargets();
      });
    },

    addTarget(draft) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);

        return targetService.addTarget(draft);
      });
    },

    reviseTarget(previousId, patch) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);

        return targetService.reviseTarget(previousId, patch);
      });
    }
  } satisfies TargetIpcService;
  const targetModule = createTargetModule(targetIpcService);

  const sessionIpcService = {
    listSessions() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionService = new SessionService(sessionRepository, stimulationSetService);

        return sessionService.listSessions();
      });
    },

    startSession(targetId) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);
        const sessionRepository = newSessionRepository(db);
        const sessionService = new SessionService(sessionRepository);

        return sessionService.startSession(targetService.requireTarget(targetId));
      });
    },

    updateAssessment(sessionId, assessment) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionService = new SessionService(sessionRepository, stimulationSetService);

        return sessionService.updateAssessment(sessionId, assessment);
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
        const sessionService = new SessionService(sessionRepository, stimulationSetService);

        return sessionService.endSession(request.sessionId, {
          finalDisturbance: request.finalDisturbance,
          notes: request.notes
        });
      });
    }
  } satisfies SessionIpcService;
  const sessionModule = createSessionModule(sessionIpcService);

  const settingIpcService = {
    getSettings() {
      return readFromAppDatabase(userDataPath(), (db) => {
        const settingRepository = newSettingRepository(db);
        const settingService = new SettingService(settingRepository);

        return settingService.getSettings();
      });
    },

    updateBilateralStimulationSettings(patch) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const settingRepository = newSettingRepository(db);
        const settingService = new SettingService(settingRepository);

        return settingService.updateBilateralStimulationSettings(patch);
      });
    }
  } satisfies SettingIpcService;
  const settingModule = createSettingModule(settingIpcService);

  const stimulationSetIpcService = {
    listBySession(sessionId) {
      return readFromAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);

        return stimulationSetService.listBySession(sessionId);
      });
    },

    logStimulationSet(draft) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);

        return stimulationSetService.logStimulationSet(draft);
      });
    }
  } satisfies StimulationSetIpcService;
  const stimulationSetModule = createStimulationSetModule(stimulationSetIpcService);

  const guideIpcService = {
    getView(request) {
      return readFromAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionService = new SessionService(sessionRepository, stimulationSetService);
        const guideService = new GuideService(targetService, sessionService, stimulationSetService);

        return guideService.getView(request);
      });
    },

    applyAction(proposal) {
      return mutateAppDatabase(userDataPath(), (db) => {
        const targetRepository = newTargetRepository(db);
        const targetService = new TargetService(targetRepository);
        const sessionRepository = newSessionRepository(db);
        const sessionLookupService = new SessionService(sessionRepository);
        const stimulationSetRepository = newStimulationSetRepository(db);
        const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService);
        const sessionService = new SessionService(sessionRepository, stimulationSetService);
        const guideService = new GuideService(targetService, sessionService, stimulationSetService);

        return guideService.applyAction(proposal);
      });
    }
  } satisfies GuideIpcService;
  const guideModule = createGuideModule(guideIpcService);

  const modules: MainModule[] = [
    vaultModule,
    targetModule,
    sessionModule,
    settingModule,
    stimulationSetModule,
    guideModule
  ];

  return modules;
}
