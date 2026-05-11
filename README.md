# EMDR Local

EMDR Local is a macOS-first desktop Electron application for private, local Eye Movement Desensitization and Reprocessing session tracking and bilateral stimulation. It runs entirely on the user's machine.

The current build is an MVP focused on proving the core flow end to end with encrypted local persistence. Several privacy, packaging, and clinical-research features are intentionally tracked as follow-up work rather than half-implemented.

## Decisions So Far

- The app is a desktop app, not a web app.
- The app is single-user and single-machine.
- The app should be usable without accounts, cloud sync, remote telemetry, or remote services.
- Network access should be blocked in Electron.
- The first supported platform is macOS.
- The first theme is dark.
- The first implementation uses Electron, React, TypeScript, and Vite.
- Dependencies and commands use `pnpm`.
- A "session" means one clinical EMDR work session in the app. Every session is complete when the user ends it.
- A target may require many sessions. Targets are unfinished until the user explicitly marks them complete.
- Local logging/telemetry is planned, but the use cases and event taxonomy need to be defined before implementation.
- Bilateral stimulation is spelled out in user-facing copy. Visual bilateral stimulation ships first; audio bilateral stimulation is a later feature.
- Markdown export is not planned. Backup/export should be encrypted database export.
- Authenticator app support is not a replacement for recovery. It may be considered later as an additional unlock factor.

## Current MVP

- Create and edit versioned targets.
- Keep prior target versions using `parentId` and `isCurrent`.
- Create an encrypted local vault protected by a password.
- Show an app-generated 256-bit recovery key during vault setup.
- Prompt the user to store the recovery key somewhere safe.
- Unlock encrypted local data with either password or recovery key.
- Export and import encrypted vault files.
- Start a session from an active target.
- Traverse sessions through a deterministic state machine.
- Capture assessment fields.
- Run visual bilateral stimulation with a moving dot.
- Persist visual bilateral stimulation speed and dot color settings.
- Log stimulation sets with observations and optional disturbance score.
- End a session with final notes and final disturbance score.
- Update the current target disturbance score from the latest session.

## Persistence

The MVP stores the SQLite database inside an encrypted local vault file named `emdr-local.vault`.

- App data is encrypted at rest with AES-256-GCM.
- The password unlock path uses scrypt to derive a wrapping key.
- The recovery key is 256 bits, app-generated, and shown once during vault setup.
- The recovery key can unlock the same encrypted data if the password is unavailable.
- No plaintext SQLite database is written by the app.
- SQLite migrations exist under `infrastructure/sqlite/migrations`.
- Export/import uses the same encrypted vault format.

### Encrypted Export Format

Encrypted exports use a `.emdr-vault` file extension. The file is a versioned JSON envelope containing encrypted SQLite bytes, not a JSON dump of application records.

The current envelope identifies:

- `format`: `emdr-local-vault`
- `version`: `1`
- `cipher`: `aes-256-gcm`
- `kdf.name`: `scrypt`
- `data.type`: `sqlite`

Export copies the encrypted vault envelope to a user-selected file. Import validates the envelope, replaces the local encrypted vault, and then requires the user to unlock the imported data with that vault's password or recovery key.

## Architecture

The code is organized around domain concepts rather than horizontal stack layers.

```text
domain/
  app/
  app-metadata/
  session/
  setting/
  stimulation-set/
  target/

infrastructure/
  security/
  sqlite/
```

Each persisted domain has its own `entity.ts` and thin typed `repository.ts`. Shared CRUD behavior lives in `infrastructure/sqlite/repository.ts`. Table definitions live in migration files, not repositories.

## Session State Machine

The current session UI is manually traversed, but state changes run through the session domain state machine in `domain/session/service.ts`.

Current states:

- `idle`
- `target_selection`
- `preparation`
- `stimulation`
- `interjection`
- `closure`
- `review`
- `post_session`

The state machine also defines allowed future agent tools per state. A future local guide agent should request actions; deterministic app code remains responsible for validating whether those actions are allowed.

## Data Model

The application domain is persisted in the local SQLite database inside the encrypted vault.

### Target

Targets are versioned records stored in the singular `target` table. A logical target is represented by one root row and later rows linked to their immediate parent.

```ts
type Target = {
  id: string;
  parentId?: string;
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

Each session references the target version that was active when the session began. Later target edits do not rewrite historical session context. The UI works with a `SessionAggregate`; the `session` table stores assessment fields as columns.

```ts
type Session = {
  id: string;
  targetId: string;
  startedAt: string;
  endedAt?: string;
  assessmentImage?: string;
  assessmentNegativeCognition: string;
  assessmentPositiveCognition: string;
  assessmentBelievability?: number;
  assessmentEmotions?: string;
  assessmentDisturbance?: number;
  assessmentBodyLocation?: string;
  finalDisturbance?: number;
  notes?: string;
};
```

### Stimulation Set

```ts
type StimulationSet = {
  id: string;
  sessionId: string;
  setNumber: number;
  createdAt: string;
  cycleCount: number;
  observation: string;
  disturbance?: number;
};
```

### Setting

Settings are stored in the singular `setting` table as keyed JSON values.

```ts
type BilateralStimulationSettings = {
  speed: number;
  dotSize: "small" | "medium" | "large";
  dotColor: "green" | "blue" | "white" | "orange";
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

- Package as a macOS `.app`.
- Add audio bilateral stimulation.
- Expand the session state machine into the full chat-first guided flow.
- Add automated tests.
- Add migration tests.
- Define local logging use cases, event names, retention expectations, and domain model before adding log storage.
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
