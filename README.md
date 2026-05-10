# EMDR Local

EMDR Local is a macOS-first desktop Electron application for private, local Eye Movement Desensitization and Reprocessing session tracking and bilateral stimulation. It is intended to run entirely on the user's machine.

The current build is an MVP focused on proving the core flow end to end. Several privacy and clinical-research features are intentionally tracked as follow-up work rather than half-implemented.

## Decisions So Far

- The app is a desktop app, not a web app.
- The app is single-user and single-machine.
- The app should be usable without accounts, cloud sync, remote telemetry, or remote services.
- Network access should be blocked in Electron.
- The first supported platform is macOS.
- The first theme is dark.
- The first implementation uses Electron, React, TypeScript, and Vite.
- A "session" means one clinical EMDR work session in the app. Every session is complete when the user ends it.
- A target may require many sessions. Targets are unfinished until the user explicitly marks them complete.
- The app should log all local activity for the user's later review and analysis. Telemetry means local activity logging only.
- Bilateral stimulation is spelled out in user-facing copy. Visual bilateral stimulation ships first; audio bilateral stimulation is a later feature.
- Markdown export is not planned. Backup/export should be encrypted database export.

## Current MVP

- Create and edit versioned targets.
- Keep prior target versions using `parentTargetId`, `rootTargetId`, and `isCurrent`.
- Start a session from an active target.
- Capture assessment fields.
- Run visual bilateral stimulation with a moving dot.
- Log stimulation sets with observations and optional disturbance score.
- End a session with final notes and final disturbance score.
- Update the current target disturbance score from the latest session.
- Preserve local activity events in the data file.

## Data Model

The MVP stores data in a local SQLite database. Encryption is a required future milestone.

### Target Version

Targets are versioned records. A logical target is represented by a root target id and one or more target-version rows.

```ts
type Target = {
  id: string;
  rootTargetId: string;
  parentTargetId?: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  description: string;
  negativeCognition: string;
  positiveCognition: string;
  clusterTag?: string;
  initialDisturbance?: number;
  currentDisturbance?: number;
  status: "active" | "completed" | "deferred";
  notes?: string;
};
```

### Session

Each session references the target version that was active when the session began. Later target edits do not rewrite historical session context.

```ts
type Session = {
  id: string;
  targetRootId: string;
  targetId: string;
  startedAt: string;
  endedAt?: string;
  assessment: Assessment;
  stimulationSets: StimulationSet[];
  finalDisturbance?: number;
  notes?: string;
};
```

### Activity Event

Activity events are append-only local telemetry.

```ts
type ActivityEvent = {
  id: string;
  timestamp: string;
  type: string;
  entityType?: "target" | "session" | "settings";
  entityId?: string;
  payload?: Record<string, unknown>;
};
```

## ADRs

Clinical-data-informed decisions must be captured as Architecture Decision Records in `docs/adr/`. Each ADR should describe:

- the decision;
- sources reviewed, with links;
- what the sources support;
- what the sources do not establish;
- the resulting product behavior.

Existing ADRs:

- [ADR 0001: Clinical Evidence Policy](docs/adr/0001-clinical-evidence-policy.md)
- [ADR 0002: Frontend Libraries](docs/adr/0002-frontend-libraries.md)
- [ADR 0003: SQLite Storage Before Encryption](docs/adr/0003-sqlite-storage.md)

## Required Follow-Up Work

- Encrypt all app data at rest.
- Require a password to unlock local data.
- Use a strong password-based key derivation function.
- Support encrypted database export/import.
- Use a 256-bit recovery/export key.
- Package as a macOS `.app`.
- Add audio bilateral stimulation.
- Add database migrations.
- Add automated tests.
- Add clinician/research ADRs before making stronger workflow claims.

## Development

```sh
pnpm install
pnpm run dev
```

Common commands are also available through `just`:

```sh
just install
just dev
just build
```

The app runs locally in Electron. It should not load remote content.
