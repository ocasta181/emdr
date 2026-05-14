import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApiRegistry } from "../dist-electron/src/main/api/registry.js";
import { GuideRoutes } from "../dist-electron/src/main/internal/domain/guide/module.js";
import { GuideService } from "../dist-electron/src/main/internal/domain/guide/service.js";
import { SessionRoutes } from "../dist-electron/src/main/internal/domain/session/module.js";
import { newSessionRepository } from "../dist-electron/src/main/internal/domain/session/repository.js";
import {
  SessionService,
  SessionWorkflowMachine
} from "../dist-electron/src/main/internal/domain/session/service.js";
import { SettingRoutes } from "../dist-electron/src/main/internal/domain/setting/module.js";
import { newSettingRepository } from "../dist-electron/src/main/internal/domain/setting/repository.js";
import { SettingService } from "../dist-electron/src/main/internal/domain/setting/service.js";
import { StimulationSetRoutes } from "../dist-electron/src/main/internal/domain/stimulation-set/module.js";
import { newStimulationSetRepository } from "../dist-electron/src/main/internal/domain/stimulation-set/repository.js";
import { StimulationSetService } from "../dist-electron/src/main/internal/domain/stimulation-set/service.js";
import { TargetRoutes } from "../dist-electron/src/main/internal/domain/target/module.js";
import { newTargetRepository } from "../dist-electron/src/main/internal/domain/target/repository.js";
import { TargetService } from "../dist-electron/src/main/internal/domain/target/service.js";
import { VaultRoutes } from "../dist-electron/src/main/internal/domain/vault/module.js";
import { VaultService } from "../dist-electron/src/main/internal/domain/vault/service.js";
import { AppStoreDatabase } from "../dist-electron/src/main/internal/lib/store/sqlite/app-store.js";
import {
  createSqliteDatabase,
  exportSqliteDatabase,
  selectAll
} from "../dist-electron/src/main/internal/lib/store/sqlite/connection.js";
import { up as initialSchema } from "../dist-electron/src/main/internal/lib/store/sqlite/migrations/0001_initial_schema.js";
import { runSqliteTransaction } from "../dist-electron/src/main/internal/lib/store/sqlite/transaction.js";
import { VaultFileService } from "../dist-electron/src/main/internal/lib/vault/service.js";

test("registered routes persist through migrated SQLite repositories and vault import", async (t) => {
  const harness = await createHarness(t);
  const request = (route, payload) => harness.routes.dispatch(route, payload);

  assert.equal(await request("vault:status"), "setupRequired");
  await request("vault:create", "passphrase-123");
  assertNoWorkflowColumn(harness.db);

  assert.throws(
    () =>
      runSqliteTransaction(harness.db, () => {
        harness.targetService.addTarget({
          description: "Rolled back target",
          negativeCognition: "temporary",
          positiveCognition: "temporary",
          status: "active"
        });
        throw new Error("rollback marker");
      }),
    /rollback marker/
  );
  assert.equal(harness.targetService.listAllTargets().length, 0);

  await assert.rejects(
    () =>
      request("target:create", {
        description: " ",
        negativeCognition: "",
        positiveCognition: "",
        status: "active"
      }),
    /Target description is required/
  );

  const target = await request("target:create", {
    description: "Integration target",
    negativeCognition: "I am blocked",
    positiveCognition: "I can proceed",
    currentDisturbance: 5,
    status: "active"
  });
  assert.equal((await request("target:list-all")).length, 1);

  harness.dialogs.exportPath = path.join(harness.tempDir, "export.emdr-vault");
  const exported = await request("vault:export");
  assert.deepEqual(exported, { canceled: false, path: harness.dialogs.exportPath });
  await access(harness.dialogs.exportPath);

  await request("target:create", {
    description: "Post-export target",
    negativeCognition: "temporary",
    positiveCognition: "temporary",
    status: "active"
  });
  assert.equal((await request("target:list-all")).length, 2);

  harness.dialogs.importPath = harness.dialogs.exportPath;
  assert.deepEqual(await request("vault:import"), { canceled: false });
  assert.equal(await request("vault:status"), "locked");
  await assert.rejects(() => request("target:list-all"), /Encrypted data is locked/);

  await request("vault:unlock-password", "passphrase-123");
  const restoredTargets = await request("target:list-all");
  assert.deepEqual(
    restoredTargets.map((item) => item.description),
    ["Integration target"]
  );
  assert.deepEqual(await request("vault:lock"), { ok: true });
  assert.equal(await request("vault:status"), "locked");
  await assert.rejects(() => request("target:list-all"), /Encrypted data is locked/);
  await request("vault:unlock-password", "passphrase-123");

  await request("session:advance-flow", { action: "start_session" });
  const session = await request("session:start", { targetId: target.id });
  await request("session:update-assessment", {
    sessionId: session.id,
    assessment: {
      negativeCognition: "I am blocked",
      positiveCognition: "I can proceed",
      disturbance: 5
    }
  });
  const guideResponse = await request("guide:message", {
    activeSessionId: session.id,
    message: "what should I do next?"
  });
  assert.equal(guideResponse.proposals.length, 0);
  assert.match(guideResponse.messages[0], /current session controls/);

  await request("session:advance-flow", { sessionId: session.id, action: "approve_assessment" });
  await request("stimulation-set:log", {
    sessionId: session.id,
    cycleCount: 24,
    observation: "first set",
    disturbance: 4
  });
  await request("session:advance-flow", { sessionId: session.id, action: "pause_stimulation" });
  await request("session:advance-flow", { sessionId: session.id, action: "begin_closure" });
  await request("session:advance-flow", { sessionId: session.id, action: "request_review" });
  await request("session:end", { sessionId: session.id, finalDisturbance: 2 });

  const sessions = await request("session:list");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].stimulationSets.length, 1);
  assert.equal(sessions[0].finalDisturbance, 2);
  assert.ok(sessions[0].endedAt);
});

async function createHarness(t) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "emdr-integration-test-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const templatePath = path.join(tempDir, "template.sqlite");
  const templateDb = await createSqliteDatabase();
  initialSchema(templateDb);
  await writeFile(templatePath, exportSqliteDatabase(templateDb));

  const routes = createApiRegistry();
  const vaultFiles = new VaultFileService(path.join(tempDir, "user-data"));
  const db = new AppStoreDatabase((dataKey, plaintext) => vaultFiles.saveSync(dataKey, plaintext), templatePath);
  const sessionWorkflow = new SessionWorkflowMachine();

  const targetRepository = newTargetRepository(db);
  const sessionRepository = newSessionRepository(db);
  const settingRepository = newSettingRepository(db);
  const stimulationSetRepository = newStimulationSetRepository(db);

  const targetService = new TargetService(targetRepository);
  const sessionLookupService = new SessionService(sessionRepository, sessionWorkflow);
  const stimulationSetService = new StimulationSetService(
    stimulationSetRepository,
    sessionLookupService,
    sessionWorkflow
  );
  const sessionService = new SessionService(sessionRepository, sessionWorkflow, stimulationSetService);
  const settingService = new SettingService(settingRepository);
  const guideService = new GuideService(targetService, sessionService, stimulationSetService);
  const vaultService = new VaultService(vaultFiles, {
    isUnlocked: () => db.isUnlocked(),
    createPlaintext: () => db.createPlaintext(),
    unlock: async (unlocked) => {
      await db.unlock(unlocked);
      sessionService.recoverSessionWorkflowFromDurableState();
    },
    lock: () => {
      db.lock();
      sessionWorkflow.reset();
    }
  });
  const dialogs = {
    exportPath: undefined,
    importPath: undefined,
    confirmImport: true,
    chooseExportPath: async () => dialogs.exportPath,
    chooseImportPath: async () => dialogs.importPath,
    confirmImportReplacement: async () => dialogs.confirmImport
  };

  new VaultRoutes(routes, vaultService, dialogs);
  new TargetRoutes(routes, targetService);
  new SessionRoutes(routes, sessionService, targetService);
  new SettingRoutes(routes, settingService);
  new StimulationSetRoutes(routes, stimulationSetService);
  new GuideRoutes(routes, guideService);

  return { db, dialogs, routes, targetService, tempDir };
}

function assertNoWorkflowColumn(db) {
  const columns = selectAll(db, 'PRAGMA table_info("session")').map((row) => row.name);
  assert.equal(columns.includes("flow_state"), false);
}
