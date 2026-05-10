import { useEffect, useState } from "react";
import {
  createVault,
  exportVault,
  getVaultStatus,
  importVault,
  loadDatabase,
  saveDatabase,
  unlockWithPassword,
  unlockWithRecoveryCode,
  type VaultStatus
} from "../../../src/db";
import type { SessionAggregate } from "../../session/types";
import type { Target } from "../../target/entity";
import type { Database } from "../types";
import { SessionFlow } from "../../session/components/SessionFlow";
import { Settings } from "../../setting/components/Settings";
import { endSession as completeSession, saveSessionDraft, startSessionForTarget } from "../../session/service";
import { Targets } from "../../target/components/Targets";
import { createEmptyDatabase } from "../factory";
import { Dashboard } from "./Dashboard";
import { RecoveryCode, VaultSetup, VaultUnlock } from "./VaultAccess";

type View = "dashboard" | "targets" | "settings" | "session";
type AuthState = "checking" | "setup" | "recovery" | "locked" | "ready";

export function App() {
  const [database, setDatabase] = useState<Database>(() => createEmptyDatabase());
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [session, setSession] = useState<SessionAggregate | null>(null);

  useEffect(() => {
    getVaultStatus().then((status) => {
      if (status === "unlocked") {
        void loadUnlockedDatabase();
      } else {
        setAuthState(authStateForVault(status));
      }
    });
  }, []);

  useEffect(() => {
    if (authState === "ready") {
      void saveDatabase(database);
    }
  }, [database, authState]);

  async function loadUnlockedDatabase() {
    setDatabase(await loadDatabase());
    setAuthState("ready");
  }

  async function setupVault(password: string) {
    const result = await createVault(password);
    setRecoveryCode(result.recoveryCode);
    setAuthState("recovery");
  }

  async function unlockVault(password: string) {
    await unlockWithPassword(password);
    await loadUnlockedDatabase();
  }

  async function unlockVaultWithRecovery(recoveryCode: string) {
    await unlockWithRecoveryCode(recoveryCode);
    await loadUnlockedDatabase();
  }

  async function exportEncryptedData() {
    const result = await exportVault();
    return result.canceled ? undefined : result.path;
  }

  async function importEncryptedData() {
    const result = await importVault();
    if (result.canceled) return false;

    setSession(null);
    setView("dashboard");
    setAuthState("locked");
    return true;
  }

  function updateDatabase(next: Database) {
    setDatabase(next);
  }

  function startSession(target: Target) {
    const next = startSessionForTarget(database, target);
    setDatabase(next.database);
    setSession(next.session);
    setView("session");
  }

  function persistSession(nextSession: SessionAggregate) {
    setSession(nextSession);
    setDatabase(saveSessionDraft(database, nextSession));
  }

  function endSession(nextSession: SessionAggregate) {
    setSession(null);
    setDatabase(completeSession(database, nextSession));
    setView("dashboard");
  }

  if (authState === "checking") {
    return <div className="boot">Loading local data...</div>;
  }

  if (authState === "setup") {
    return <VaultSetup onCreate={setupVault} onImport={importEncryptedData} />;
  }

  if (authState === "recovery") {
    return <RecoveryCode recoveryCode={recoveryCode} onContinue={loadUnlockedDatabase} />;
  }

  if (authState === "locked") {
    return (
      <VaultUnlock
        onUnlock={unlockVault}
        onRecoveryUnlock={unlockVaultWithRecovery}
        onImport={importEncryptedData}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">EMDR Local</div>
          <div className="subtle">Local-only session tracking and visual bilateral stimulation</div>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={view === "targets" ? "active" : ""} onClick={() => setView("targets")}>
            Targets
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            Settings
          </button>
        </nav>
      </header>

      {view === "dashboard" && <Dashboard database={database} onStartSession={startSession} />}
      {view === "targets" && <Targets database={database} onChange={updateDatabase} />}
      {view === "settings" && (
        <Settings
          database={database}
          onChange={updateDatabase}
          onExportEncryptedData={exportEncryptedData}
          onImportEncryptedData={importEncryptedData}
        />
      )}
      {view === "session" && session && (
        <SessionFlow
          database={database}
          session={session}
          onDatabaseChange={updateDatabase}
          onPersist={persistSession}
          onEnd={endSession}
        />
      )}
    </div>
  );
}

function authStateForVault(status: VaultStatus): AuthState {
  if (status === "setupRequired") return "setup";
  if (status === "locked") return "locked";
  return "ready";
}
