import { existsSync } from "node:fs";
import path from "node:path";
import { GuideAgentSidecarClient } from "../internal/domain/guide/agent-client.js";
import { GuideRoutes } from "../internal/domain/guide/module.js";
import { GuideService } from "../internal/domain/guide/service.js";
import { SessionRoutes } from "../internal/domain/session/module.js";
import { newSessionRepository } from "../internal/domain/session/repository.js";
import { SessionService, SessionWorkflowMachine } from "../internal/domain/session/service.js";
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
import { VaultService } from "../internal/domain/vault/service.js";
import { AgentSidecar, JsonLineAgentTransport } from "../internal/lib/agent/index.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";
import { AppStoreDatabase } from "../internal/lib/store/sqlite/app-store.js";
import { VaultFileService } from "../internal/lib/vault/service.js";
import type { InitializeOptions, MainModule } from "./types.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  const routes = options.routes;
  const userDataPath = options.getUserDataPath;

  const vaultFileService = new VaultFileService(userDataPath());
  const db = new AppStoreDatabase((dataKey, plaintext) => vaultFileService.saveSync(dataKey, plaintext));

  const targetRepository = newTargetRepository(db);
  const sessionRepository = newSessionRepository(db);
  const settingRepository = newSettingRepository(db);
  const stimulationSetRepository = newStimulationSetRepository(db);

  const sessionWorkflow = new SessionWorkflowMachine();
  const targetService = new TargetService(targetRepository);
  const sessionLookupService = new SessionService(sessionRepository, sessionWorkflow);
  const stimulationSetService = new StimulationSetService(stimulationSetRepository, sessionLookupService, sessionWorkflow);
  const sessionService = new SessionService(sessionRepository, sessionWorkflow, stimulationSetService);
  const settingService = new SettingService(settingRepository);

  const scriptedGuideAgentPath = path.resolve("agent/scripted-guide-sidecar.mjs");
  const guideAgentSidecar = existsSync(scriptedGuideAgentPath)
    ? new AgentSidecar(
        {
          command: process.execPath,
          args: [scriptedGuideAgentPath],
          startupTimeoutMs: 1000,
          shutdownTimeoutMs: 1000
        },
        undefined,
        (child) => new JsonLineAgentTransport(child.stdout, child.stdin)
      )
    : undefined;
  const guideAgent = guideAgentSidecar ? new GuideAgentSidecarClient(guideAgentSidecar) : undefined;
  const guideService = new GuideService(targetService, sessionService, stimulationSetService, guideAgent);
  const vaultService = new VaultService(vaultFileService, {
    isUnlocked: () => db.isUnlocked(),
    createPlaintext: () => db.createPlaintextFromTemplate(),
    unlock: async (unlocked) => {
      await db.unlock(unlocked);
      sessionService.recoverSessionWorkflowFromDurableState();
    },
    lock: () => {
      db.lock();
      sessionWorkflow.reset();
    }
  });

  const vaultRoutes = new VaultRoutes(routes, vaultService, createVaultFileDialogs());
  const targetRoutes = new TargetRoutes(routes, targetService);
  const sessionRoutes = new SessionRoutes(routes, sessionService, targetService);
  const settingRoutes = new SettingRoutes(routes, settingService);
  const stimulationSetRoutes = new StimulationSetRoutes(routes, stimulationSetService);
  const guideRoutes = new GuideRoutes(routes, guideService);

  return [vaultRoutes, targetRoutes, sessionRoutes, settingRoutes, stimulationSetRoutes, guideRoutes];
}
