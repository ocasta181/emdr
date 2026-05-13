import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
import { VaultFileService } from "../dist-electron/src/main/internal/lib/vault/service.js";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "emdr-workflow-smoke-"));

try {
  const templatePath = path.join(tempDir, "template.sqlite");
  const templateDb = await createSqliteDatabase();
  initialSchema(templateDb);
  await writeFile(templatePath, exportSqliteDatabase(templateDb));
  process.env.EMDR_SQLITE_TEMPLATE_PATH = templatePath;

  const routes = createApiRegistry();
  const vaultFileService = new VaultFileService(path.join(tempDir, "user-data"));
  const db = new AppStoreDatabase((dataKey, plaintext) => vaultFileService.saveSync(dataKey, plaintext));
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
  const fakeDialogs = {
    chooseExportPath: async () => undefined,
    chooseImportPath: async () => undefined,
    confirmImportReplacement: async () => false
  };

  new VaultRoutes(routes, vaultService, fakeDialogs);
  new TargetRoutes(routes, targetService);
  new SessionRoutes(routes, sessionService, targetService);
  new SettingRoutes(routes, settingService);
  new StimulationSetRoutes(routes, stimulationSetService);
  new GuideRoutes(routes, guideService);

  const request = (route, payload) => routes.dispatch(route, payload);

  await request("vault:create", "passphrase-123");
  assertNoSessionWorkflowColumn(db);

  const target = await request("target:create", {
    description: "Workflow smoke target",
    negativeCognition: "I am stuck",
    positiveCognition: "I can move",
    status: "active"
  });

  await expectWorkflow(request("session:workflow"), "idle");
  await expectWorkflow(request("session:advance-flow", { action: "start_session" }), "target_selection");
  const session = await request("session:start", { targetId: target.id });
  await expectWorkflow(request("session:workflow"), "preparation", session.id);

  await expectRejects(
    request("stimulation-set:log", { sessionId: session.id, cycleCount: 12, observation: "too early" }),
    "logging before stimulation"
  );
  await expectRejectedGuideAction(
    request("guide:apply-action", {
      type: "end_session",
      sessionId: session.id,
      workflowState: "preparation"
    }),
    "ending before review"
  );

  await request("session:update-assessment", {
    sessionId: session.id,
    assessment: {
      negativeCognition: "I am stuck",
      positiveCognition: "I can move",
      disturbance: 5
    }
  });
  await expectWorkflow(request("session:advance-flow", { sessionId: session.id, action: "approve_assessment" }), "stimulation", session.id);

  const logResult = await request("guide:apply-action", {
    type: "log_stimulation_set",
    sessionId: session.id,
    workflowState: "stimulation",
    cycleCount: 24,
    observation: ""
  });
  assertAccepted(logResult, "log stimulation set");

  db.lock();
  sessionWorkflow.reset();
  await request("vault:unlock-password", "passphrase-123");
  await expectWorkflow(request("session:workflow"), "interjection", session.id);
  await request("vault:lock");
  await expectRejects(request("session:list"), "session list while locked");
  await request("vault:unlock-password", "passphrase-123");
  await expectWorkflow(request("session:workflow"), "interjection", session.id);
  await expectWorkflow(request("session:advance-flow", { sessionId: session.id, action: "continue_stimulation" }), "stimulation", session.id);
  await expectWorkflow(request("session:advance-flow", { sessionId: session.id, action: "pause_stimulation" }), "interjection", session.id);
  await expectWorkflow(request("session:advance-flow", { sessionId: session.id, action: "begin_closure" }), "closure", session.id);
  await expectWorkflow(request("session:advance-flow", { sessionId: session.id, action: "request_review" }), "review", session.id);

  const endResult = await request("guide:apply-action", {
    type: "end_session",
    sessionId: session.id,
    workflowState: "review"
  });
  assertAccepted(endResult, "end session");
  await expectWorkflow(Promise.resolve(endResult.workflow), "post_session", session.id);
  await expectWorkflow(request("session:advance-flow", { sessionId: session.id, action: "return_to_idle" }), "idle");

  const sessions = await request("session:list");
  if (!sessions[0]?.endedAt || sessions[0].stimulationSets.length !== 1) {
    throw new Error(`Expected ended session with one set, got ${JSON.stringify(sessions)}`);
  }

  console.log("Workflow smoke passed.");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function assertNoSessionWorkflowColumn(db) {
  const columns = selectAll(db, 'PRAGMA table_info("session")').map((row) => row.name);
  if (columns.includes("flow_state")) {
    throw new Error("Session workflow state must not be persisted in SQLite.");
  }
}

async function expectWorkflow(resultPromise, state, activeSessionId) {
  const workflow = await resultPromise;
  if (workflow.state !== state || workflow.activeSessionId !== activeSessionId) {
    throw new Error(`Expected workflow ${state}, got ${JSON.stringify(workflow)}`);
  }
}

async function expectRejects(resultPromise, label) {
  try {
    await resultPromise;
  } catch {
    return;
  }

  throw new Error(`Expected ${label} to reject.`);
}

async function expectRejectedGuideAction(resultPromise, label) {
  const result = await resultPromise;
  if (result.accepted) {
    throw new Error(`Expected ${label} to be rejected.`);
  }
}

function assertAccepted(result, label) {
  if (!result.accepted) {
    throw new Error(`Expected ${label} to be accepted, got ${JSON.stringify(result)}`);
  }
}
