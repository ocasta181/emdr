import type { Database } from "../app/types";
import type { SessionAggregate } from "./types";

export function upsertSession(database: Database, session: SessionAggregate) {
  const exists = database.sessions.some((item) => item.id === session.id);
  return {
    ...database,
    sessions: exists
      ? database.sessions.map((item) => (item.id === session.id ? session : item))
      : database.sessions.concat(session)
  };
}
