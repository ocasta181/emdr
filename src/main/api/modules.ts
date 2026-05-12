import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { createVaultModule } from "../internal/domain/vault/module.js";
import { createTargetModule } from "../internal/domain/target/module.js";
import { createSettingModule } from "../internal/domain/setting/module.js";
import { createStimulationSetModule } from "../internal/domain/stimulation-set/module.js";
import { createSessionModule } from "../internal/domain/session/module.js";
import { newSessionRepository } from "../internal/domain/session/repository.js";
import { nextSessionFlowState, SessionService } from "../internal/domain/session/service.js";
import { newSettingRepository } from "../internal/domain/setting/repository.js";
import { SettingService } from "../internal/domain/setting/service.js";
import { newStimulationSetRepository } from "../internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../internal/domain/stimulation-set/service.js";
import type { StimulationSetDraft } from "../internal/domain/stimulation-set/types.js";
import { newTargetRepository } from "../internal/domain/target/repository.js";
import { TargetService } from "../internal/domain/target/service.js";
import type { TargetDraft, TargetRevisionRequest } from "../internal/domain/target/types.js";
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
import type { SqliteDatabase } from "../internal/lib/store/sqlite/connection.js";
import type { InitializeOptions, MainModule } from "./types.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const userDataPath = options.getUserDataPath;
  const vaultDialogs = createVaultFileDialogs();

  return [
    createVaultModule({
      status() {
        return appVaultStatus(userDataPath());
      },

      create(password: string) {
        return createAppVault(userDataPath(), password);
      },

      async unlockWithPassword(password: string) {
        await unlockAppVaultWithPassword(userDataPath(), password);
        return { ok: true };
      },

      async unlockWithRecoveryCode(recoveryCode: string) {
        await unlockAppVaultWithRecoveryCode(userDataPath(), recoveryCode);
        return { ok: true };
      },

      async exportVault() {
        const destinationPath = await vaultDialogs.chooseExportPath(new VaultService(userDataPath()).defaultExportName());
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
    }),
    createTargetModule({
      listCurrentTargets() {
        return readServices(userDataPath, (services) => services.targets.listCurrentTargets());
      },

      listAllTargets() {
        return readServices(userDataPath, (services) => services.targets.listAllTargets());
      },

      addTarget(draft: TargetDraft) {
        return mutateServices(userDataPath, (services) => services.targets.addTarget(draft));
      },

      reviseTarget(previousId: string, patch: TargetRevisionRequest["patch"]) {
        return mutateServices(userDataPath, (services) => services.targets.reviseTarget(previousId, patch));
      }
    }),
    createSessionModule({
      listSessions() {
        return readServices(userDataPath, (services) => services.sessions.listSessions());
      },

      startSession(targetId: string) {
        return mutateServices(userDataPath, (services) =>
          services.sessions.startSession(services.targets.requireTarget(targetId))
        );
      },

      updateAssessment(sessionId, assessment) {
        return mutateServices(userDataPath, (services) => services.sessions.updateAssessment(sessionId, assessment));
      },

      nextSessionFlowState(state, action) {
        return nextSessionFlowState(state, action);
      },

      endSession(request) {
        return mutateServices(userDataPath, (services) =>
          services.sessions.endSession(request.sessionId, {
            finalDisturbance: request.finalDisturbance,
            notes: request.notes
          })
        );
      }
    }),
    createSettingModule({
      getSettings() {
        return readServices(userDataPath, (services) => services.settings.getSettings());
      },

      updateBilateralStimulationSettings(patch) {
        return mutateServices(userDataPath, (services) =>
          services.settings.updateBilateralStimulationSettings(patch)
        );
      }
    }),
    createStimulationSetModule({
      listBySession(sessionId: string) {
        return readServices(userDataPath, (services) => services.stimulationSets.listBySession(sessionId));
      },

      logStimulationSet(draft: StimulationSetDraft) {
        return mutateServices(userDataPath, (services) => services.stimulationSets.logStimulationSet(draft));
      }
    })
  ];
}

function readServices<T>(userDataPath: () => string, reader: (services: ReturnType<typeof createDomainServices>) => T) {
  return readFromAppDatabase(userDataPath(), (db) => reader(createDomainServices(db)));
}

function mutateServices<T>(
  userDataPath: () => string,
  mutator: (services: ReturnType<typeof createDomainServices>) => T
) {
  return mutateAppDatabase(userDataPath(), (db) => mutator(createDomainServices(db)));
}

function createDomainServices(db: SqliteDatabase) {
  const sessionLookup = new SessionService(newSessionRepository(db));
  const stimulationSets = new StimulationSetService(newStimulationSetRepository(db), sessionLookup);

  return {
    targets: new TargetService(newTargetRepository(db)),
    sessions: new SessionService(newSessionRepository(db), stimulationSets),
    settings: new SettingService(newSettingRepository(db)),
    stimulationSets
  };
}
