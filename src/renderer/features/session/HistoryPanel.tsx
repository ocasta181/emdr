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
          const endedAt = session.endedAt ? new Date(session.endedAt).toLocaleString() : "Ongoing";
          const setCount = session.stimulationSets.length;
          return (
            <article className="historyRow" key={session.id}>
              <div>
                <h2>{target?.description ?? "Unknown target"}</h2>
                <p>Started {startedAt}</p>
                <p>{session.endedAt ? `Ended ${endedAt}` : endedAt}</p>
                <p>{formatSessionSummary(setCount, session.assessment.disturbance, session.finalDisturbance)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function formatSessionSummary(setCount: number, initialSud: number | undefined, finalSud: number | undefined) {
  const parts = [`${setCount} ${setCount === 1 ? "set" : "sets"}`];
  if (initialSud !== undefined) parts.push(`SUD start ${initialSud}`);
  if (finalSud !== undefined) parts.push(`SUD end ${finalSud}`);
  return parts.join(" · ");
}
