import { useEffect, useState } from "react";
import { loadDatabase, saveDatabase } from "../../../src/db";
import type { SessionAggregate } from "../../session/types";
import type { Target } from "../../target/entity";
import type { Database } from "../types";
import { SessionFlow } from "../../session/components/SessionFlow";
import { endSession as completeSession, saveSessionDraft, startSessionForTarget } from "../../session/service";
import { Targets } from "../../target/components/Targets";
import { createEmptyDatabase } from "../factory";
import { Dashboard } from "./Dashboard";

type View = "dashboard" | "targets" | "session";

export function App() {
  const [database, setDatabase] = useState<Database>(() => createEmptyDatabase());
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [session, setSession] = useState<SessionAggregate | null>(null);

  useEffect(() => {
    loadDatabase().then((loadedDatabase) => {
      setDatabase(loadedDatabase);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      void saveDatabase(database);
    }
  }, [database, loaded]);

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

  if (!loaded) {
    return <div className="boot">Loading local data...</div>;
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
        </nav>
      </header>

      {view === "dashboard" && <Dashboard database={database} onStartSession={startSession} />}
      {view === "targets" && <Targets database={database} onChange={updateDatabase} />}
      {view === "session" && session && (
        <SessionFlow database={database} session={session} onPersist={persistSession} onEnd={endSession} />
      )}
    </div>
  );
}
