import { useState } from "react";
import type { SessionAggregate, Target } from "../../../shared/types";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

export function HistoryPanel({
  sessions,
  targetById
}: {
  sessions: SessionAggregate[];
  targetById: Map<string, Target>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      {sessions.length === 0 && <p className="authNotice">No sessions yet.</p>}
      <div className="historyList">
        {sessions.map((session) => {
          const target = targetById.get(session.targetId);
          const started = new Date(session.startedAt);
          const ended = session.endedAt ? new Date(session.endedAt) : undefined;
          const setCount = session.stimulationSets.length;
          const startSud = session.assessment.disturbance;
          const endSud = session.finalDisturbance;
          return (
            <article className="historyItem" key={session.id}>
              <button
                type="button"
                className="historyRow"
                aria-expanded={openId === session.id}
                onClick={() => setOpenId((current) => (current === session.id ? null : session.id))}
              >
                <span className="historyText">
                  <span className="historyTitle">{target?.description ?? "Unknown target"}</span>
                  <span className="historyMeta">
                    {dateFormat.format(started)} · {timeFormat.format(started)}
                    {formatEnd(started, ended)} · {setCount} {setCount === 1 ? "set" : "sets"}
                  </span>
                </span>
                {(startSud !== undefined || endSud !== undefined) && (
                  <span className="sudChange" aria-label={formatSudLabel(startSud, endSud)}>
                    {startSud !== undefined && <span>{startSud}</span>}
                    {startSud !== undefined && endSud !== undefined && <span aria-hidden="true">→</span>}
                    {endSud !== undefined && <strong>{endSud}</strong>}
                    <small>SUD</small>
                  </span>
                )}
              </button>
              {openId === session.id && <SessionDetail session={session} />}
            </article>
          );
        })}
      </div>
    </>
  );
}

function formatEnd(started: Date, ended: Date | undefined) {
  if (!ended) return " · Ongoing";
  const end = timeFormat.format(ended);
  return end === timeFormat.format(started) ? "" : `–${end}`;
}

function formatSudLabel(startSud: number | undefined, endSud: number | undefined) {
  const parts = [];
  if (startSud !== undefined) parts.push(`SUD start ${startSud}`);
  if (endSud !== undefined) parts.push(`SUD end ${endSud}`);
  return parts.join(", ");
}

function SessionDetail({ session }: { session: SessionAggregate }) {
  const { negativeCognition, positiveCognition, believability } = session.assessment;
  const hasBeliefs = Boolean(negativeCognition || positiveCognition);
  const notes = session.notes?.trim();
  return (
    <div className="historyDetail">
      {hasBeliefs && (
        <dl className="historyBeliefs">
          {negativeCognition && (
            <div>
              <dt>Negative cognition</dt>
              <dd>{negativeCognition}</dd>
            </div>
          )}
          {positiveCognition && (
            <div>
              <dt>Positive cognition</dt>
              <dd>
                {positiveCognition}
                {believability !== undefined && <span className="historyVoc"> · VOC {believability}</span>}
              </dd>
            </div>
          )}
        </dl>
      )}
      {session.stimulationSets.length > 0 && (
        <ol className="historySets">
          {session.stimulationSets.map((set) => (
            <li key={set.id}>
              <span>
                Set {set.setNumber} · {set.cycleCount} {set.cycleCount === 1 ? "cycle" : "cycles"}
                {set.disturbance !== undefined && ` · SUD ${set.disturbance}`}
              </span>
              {set.observation.trim() && <p>{set.observation}</p>}
            </li>
          ))}
        </ol>
      )}
      {notes ? <p className="historyNotes">{notes}</p> : <p className="historyEmpty">No notes for this session.</p>}
    </div>
  );
}
