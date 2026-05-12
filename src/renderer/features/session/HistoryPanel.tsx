import type { SessionAggregate, Target } from "../../../shared/types";

export function HistoryPanel({
  sessions,
  targetById
}: {
  sessions: SessionAggregate[];
  targetById: Map<string, Target>;
}) {
  return (
    <>
      <h1>History</h1>
      {sessions.length === 0 && <p className="authNotice">No sessions yet.</p>}
      <div className="targetList">
        {sessions.map((session) => {
          const target = targetById.get(session.targetId);
          const startedAt = new Date(session.startedAt).toLocaleString();
          const endedAt = session.endedAt ? new Date(session.endedAt).toLocaleString() : "ongoing";
          return (
            <article className="targetRow" key={session.id}>
              <div>
                <h2>{target?.description ?? "Unknown target"}</h2>
                <p>
                  Started {startedAt} · {endedAt}
                </p>
                <p>
                  {session.stimulationSets.length} set
                  {session.stimulationSets.length === 1 ? "" : "s"}
                  {session.assessment.disturbance !== undefined
                    ? ` · SUD start ${session.assessment.disturbance}`
                    : ""}
                  {session.finalDisturbance !== undefined ? ` · SUD end ${session.finalDisturbance}` : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
