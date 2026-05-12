# Architecture Migration Plan

This plan migrates the current codebase toward the architecture specified in
[architecture.md](architecture.md). It is based on the repository state reviewed
on 2026-05-11 and the UI end-to-end smoke reviewed on 2026-05-12.

## Current Baseline

The target architecture is now:

```text
electron/main.ts
  -> src/main/api
  -> src/main/internal/domain/*
  -> src/main/internal/lib/*

src/renderer/*
  -> electron/preload.cts generic bridge
  -> src/main/api registered routes

src/shared/*
  -> serializable type contracts only
```

The main API layer owns startup, module wiring, and the route registry. Domains
self-register their IPC endpoints with that registry. Preload is a
domain-agnostic bridge and does not know which routes exist. Renderer display
code is airgapped from `src/main/**`; it can call renderer API clients, but it
must not import main internals.

The current codebase is partway through that migration:

- `electron/main.ts` is a thin entrypoint that hands off to `src/main/api/app.ts`.
- `src/main/api/app.ts` owns Electron lifecycle, network blocking, window
  creation setup, and registry initialization.
- `electron/preload.cts` exposes a generic request/subscription bridge.
- `src/renderer/app/AnimatedApp.tsx` is the active React shell. It calls
  renderer API clients and keeps display-only view data for active targets,
  history, settings, and panel state.
- `src/renderer/api/client.ts` is the renderer-side IPC client surface. It has no
  local persistence fallback.
- `src/shared/types.ts` holds serializable view contracts shared across the
  renderer/main process boundary.
- Transitional `legacy:*` full-snapshot IPC routes have been removed.
- `src/main/api/` now has only `app.ts`, `modules.ts`, `registry.ts`, and
  `types.ts`.
- `src/main/internal/lib/store/sqlite/app-store.ts` keeps vault unlock state and
  encrypted save behavior. It does not create or migrate schemas.
- SQLite schema creation is owned by the single baseline migration
  `src/main/internal/lib/store/sqlite/migrations/0001_initial_schema.ts`.
- `pnpm migrate:sqlite -- --database <path>` creates or migrates a standalone
  SQLite template. Fresh vault setup reads that migrated template from
  `EMDR_SQLITE_TEMPLATE_PATH`.
- Domain services, repositories, and IPC endpoint definitions exist under
  `src/main/internal/domain`; the guide domain now owns non-display guide view
  decisions while renderer animation remains in `src/renderer/animation`.
- `src/main/api/modules.ts` centralizes repository and service construction for
  handlers that run against the active unlocked database.
- `src/main/api/modules.ts` now manually instantiates the app store, table
  repositories, services, and route modules in dependency order. The store
  object exists at startup and starts locked.
- API-layer `*-route-service.ts` adapters have been removed; domain `ipc.ts`
  files validate route payloads and call domain services directly.
- Domain repositories are table repositories and are enforced as
  `(db: SqliteDatabase)` factories.
- Vault unlock/import/export is modeled as whole-store lifecycle. The vault
  service receives narrow store lifecycle functions instead of the full database
  object.
- Generic agent sidecar process and JSON-line transport infrastructure exists
  under `src/main/internal/lib/agent`; guide action proposals are validated and
  applied through domain services, but no live agent sidecar is wired yet.
- A registry-level smoke confirms vault setup/unlock, target creation, session
  start/end, stimulation-set logging, guide action validation, export/import,
  and relaunch unlock through registered routes.
- A UI smoke confirms setup, password unlock, target creation, session start,
  stimulation start/pause, stimulation-set logging, session end, relaunch, and
  history display.
- The session workflow state machine now lives in main-process memory. It is
  reset on vault unlock/lock and is not persisted to SQLite.
- The visible animated UI now starts sessions, starts/pauses stimulation, logs
  sets, and ends sessions through graph-validated workflow commands.
- Preparation, assessment approval, closure, review, and post-session workflow
  screens are not represented in the visible UI.

Verification targets:

- `pnpm run build`
- `pnpm run check:architecture`
- `pnpm migrate:sqlite -- --database <path>`
- Registry-level route smoke using a fresh vault and migrated template
- Electron smoke test with `EMDR_SQLITE_TEMPLATE_PATH` pointing at a migrated
  SQLite template

## Migration Rules

- Migrate structure first, then restore the build.
- Preserve encrypted vault compatibility unless a deliberate vault migration is
  added and tested.
- Do not modify the SQLite schema without express permission.
- This codebase is not live yet, so any approved schema change must be folded
  into the single baseline SQLite migration, `0001_initial_schema.ts`.
- After the first live release, schema changes must be new versioned migrations.
- Never run migrations from app startup, vault setup, unlock, import, export, or
  repository code.
- Keep the app local-only. Electron should continue blocking remote content.
- Keep `src/main/**` free of React, Pixi, display state, and browser-only APIs.
- Keep renderer code free of imports from `src/main/internal/**`.
- Keep session workflow state authoritative in the main session domain. The
  renderer can mirror workflow state returned by main, but it must not invent or
  bypass workflow transitions.
- Commit after each coherent migration step with a 3-8 word message.
- Prefer moving behavior behind the future boundary before moving files, so path
  churn does not hide behavior changes.
- Do not make preload aware of domain route registration.

## Phase 1: Introduce Main API Skeleton

Goal: create the target main-process skeleton and move startup behind it before
fixing renderer or build issues.

Checklist:

- [x] Create `src/main/api/app.ts` with `Start()` as the main-process startup
  handoff.
- [x] Create `src/main/api/registry.ts` for the central IPC route registry.
- [x] Create `src/main/api/modules.ts` for dependency injection and module
  initialization.
- [x] Create `src/main/internal/domain` as the future bounded-context root.
- [x] Create `src/main/internal/lib/{ipc,store,vault,agent,electron}` as the
  future infrastructure roots.
- [x] Make `electron/main.ts` call `Start()` and stop owning startup directly.
- [x] Keep behavior equivalent where code is moved, even if existing compile
  errors remain.
- [x] Run `pnpm run check:architecture:staged` before committing.

Exit criteria:

- [x] `electron/main.ts` is a thin entrypoint.
- [x] Main startup lives in `src/main/api/app.ts`.
- [x] The route registry type and registration surface exist.
- [x] `modules.ts` is the place future domain module wiring will happen.

## Phase 2: Move Current Main Runtime Into API

Goal: make `src/main/api` own the current main-process lifecycle while preserving
the existing generic channels temporarily.

Checklist:

- [x] Move window creation setup into `src/main/internal/lib/electron`.
- [x] Move network guard setup into `src/main/internal/lib/electron`.
- [x] Move raw IPC helper logic into `src/main/internal/lib/ipc`.
- [x] Register the current vault and `db:*` handlers through
  `src/main/api/registry.ts` as transitional routes.
- [x] Initialize current store and vault dependencies through
  `src/main/api/modules.ts`.
- [x] Keep native dialog access behind Electron adapters.

Exit criteria:

- [x] `src/main/api/app.ts` owns Electron startup and module registration.
- [x] `electron/main.ts` has no domain, store, vault, or IPC handler logic.
- [x] Current runtime behavior is still represented, even if the renderer build
  is not fixed yet.

## Phase 3: Introduce Domain Self-Registered Routes

Goal: replace generic database snapshot IPC with domain-owned API routes.

Checklist:

- [x] Add a small module shape for main-process domains. Domain route objects
  self-register with the API registry during construction.
- [x] Move vault IPC registration into `src/main/internal/domain/vault/ipc.ts`.
- [x] Add target routes for list, create, and revise.
- [x] Add session routes for start, assessment update, flow transition, and end.
- [x] Add stimulation-set routes for logging and listing by session.
- [x] Add setting routes for read and bilateral-stimulation update.
- [x] Add query routes for current targets, all targets, sessions, and settings
  view data.
- [x] Validate route payloads at the domain IPC boundary.
- [x] Delete the transitional generic `db:load` and `db:save` routes after
  equivalent domain routes exist.

Exit criteria:

- [x] Domain modules self-register their endpoints with the API registry.
- [x] `src/main/api/registry.ts` owns route registration mechanics but no domain
  behavior.
- [x] No `db:*` channels remain.

## Phase 4: Rehome Store, Vault, And Domain Code

Goal: move current internal code to the agreed target roots.

Checklist:

- [x] Move generic SQLite connection, transaction, and migration runner code to
  `src/main/internal/lib/store`.
- [x] Move vault crypto and file primitives to `src/main/internal/lib/vault`.
- [x] Remove the non-domain `app` abstraction.
- [x] Move vault, target, session, stimulation-set, and setting domains to
  `src/main/internal/domain/<domain>`.
- [x] Move guide domain to
  `src/main/internal/domain/<domain>`.
- [x] Keep repositories in their owning domain folders.
- [x] Keep generic SQL adapter abstractions in `src/main/internal/lib/store`.
- [x] Remove runtime database snapshot creation and migration logic from
  `src/main/internal/lib/store/sqlite/app-store.ts`.
- [x] Add standalone SQLite migration tooling for creating migrated database
  templates.
- [x] Replace full-snapshot `replaceAll` persistence with granular repository
  writes for command handlers.
  - [x] Target routes write through `TargetService` and the target repository.
  - [x] Session routes write through `SessionService` and session repositories.
  - [x] Stimulation-set routes write through `StimulationSetService` and the
    stimulation-set repository.
  - [x] Setting routes write through `SettingService` and the setting repository.
- [x] Add transaction helpers for workflows that update multiple tables.

Exit criteria:

- [x] Only repositories and generic store infrastructure import `sql.js`.
- [x] No renderer or preload code imports main internals or store modules.
- [ ] Domain-specific SQL and mappings live with the owning domain.
- [x] Legacy `core/internal` store and vault paths are removed or reduced to
  temporary shims.

## Phase 5: Decouple Preload And Renderer

Goal: make preload a domain-agnostic bridge and React presentation-only.

Checklist:

- [x] Replace domain-specific preload methods with generic request and
  subscription functions.
- [x] Ensure preload imports no domain endpoint definitions.
- [x] Create `src/renderer/app` for React root, layout, providers, and top-level
  screen composition.
- [x] Move active UI from `domain/*/components` to `src/renderer`.
- [x] Move Pixi/animation code from `src/animation` into renderer guide or room
  feature folders.
- [x] Replace renderer imports from domain factories and services with
  transport-backed feature clients or presentation-only helpers.
- [x] Remove `src/db.ts` and the `localStorage` fallback.
- [x] Keep renderer state limited to form drafts, selected panels, animation
  state, transient chat input, loading state, and error display.

Exit criteria:

- [x] Preload has no domain-specific route list.
- [x] `src/renderer` does not import `src/main`, `core`, `electron`,
  repositories, factories, or main-process services.
- [x] React components do not construct domain records or mutate authoritative
  collections.

## Phase 6: Restore Buildable State

Goal: after the structural migration, make the app compile and remove temporary
compatibility code.

Checklist:

- [x] Replace renderer imports of removed service functions with migrated route
  calls or renderer-local helpers.
- [x] Move direct `nowIso`, target creation, session creation, stimulation-set
  creation, and settings mutation out of React components.
- [x] Remove direct renderer collection mutation of the authoritative `Database`.
- [x] Preserve behavior for target creation, target revision, session start/end,
  stimulation-set logging, settings changes, vault setup, unlock, import, and
  export.
- [x] Delete transitional route aliases and legacy import shims.
- [x] Run `pnpm run build`.
- [x] Run `pnpm run check:architecture:staged` before each commit.

Exit criteria:

- [x] `pnpm run build` succeeds.
- [x] New or changed TypeScript files pass the staged architecture check.
- [x] Existing full architecture violations are reduced to only planned
  follow-up work.

## Phase 7: Add Agent Infrastructure

Goal: implement the local guide sidecar without weakening the main-process
authority boundary.

Checklist:

- [x] Add `src/main/internal/lib/agent` for sidecar startup, shutdown, health
  checks, transport, and model runtime configuration.
- [x] Add `src/main/internal/domain/guide` for guide prompts, structured action
  schemas, action validation, and guide-specific state.
- [x] Route agent proposed actions through the same domain services used by human
  UI commands.
- [x] Reject invalid agent actions in main before any mutation.
- [x] Ensure the agent never imports renderer code, repositories, SQLite code, or
  Electron IPC.
- [ ] Add tests for allowed and rejected guide actions per session state.
- [ ] Wire a live agent sidecar into guide domain routes.

Exit criteria:

- [ ] Agent output is advisory and structured.
- [ ] Main process remains the only state mutator.
- [ ] Renderer displays guide messages and proposed edits from main-process view
  events.

## Phase 8: Wire UI To Session State Machine

Goal: make the visible app flow use the session graph end-to-end instead of
calling lower-level mutation routes directly.

Earlier gap found by UI E2E:

- The main process registers `session:transition-flow` and `guide:apply-action`.
- The renderer API client did not expose those routes.
- `AnimatedApp.tsx` called direct mutation routes for session start, set
  logging, and session end.
- The renderer had no `SessionFlowState` view model and no preparation,
  assessment, closure, or review screens.

Checklist:

- [x] Add authoritative session workflow state to the session domain as
  main-process memory managed by the state machine. Do not persist this state in
  SQLite.
- [x] Make session domain commands validate and advance workflow state before
  mutating sessions or stimulation sets.
- [x] Keep `session:transition-flow` as read-only preview naming and add a
  separate mutating workflow command route.
- [x] Expose renderer API client methods for graph-validated workflow commands.
- [x] Route UI session start through `idle -> target_selection -> preparation`
  instead of directly creating an active session without workflow state.
- [x] Add preparation and assessment UI that updates assessment data and advances
  through `update_assessment` and `approve_assessment`.
- [x] Route stimulation start, pause, continuation, and set logging through
  graph-validated actions.
- [x] Route closure, review, and session end through graph-validated actions.
- [x] Update `GuideService.applyAction` and renderer guide actions so human UI
  and future agent proposals use the same validation path.
- [x] Update view models so `guide:view`, session history, and active-session UI
  expose the current workflow state where useful without persisting it.
- [x] Add manual UI coverage for the full graph:
  `idle -> target_selection -> preparation -> stimulation -> interjection ->
  closure -> review -> post_session`.
- [ ] Add a regression check that the UI cannot log stimulation before the graph
  reaches `stimulation`.
- [ ] Add a regression check that the UI cannot end a session before `review`.

Exit criteria:

- [x] The visible Electron UI can traverse the full session graph end-to-end.
- [x] Renderer code no longer starts sessions, logs stimulation sets, or ends
  sessions through graph-bypassing mutation routes.
- [ ] Renderer refresh during an active session restores the authoritative
  workflow state from main memory.
- [ ] Define recovery behavior for app relaunch with an unfinished durable
  session row, without persisting application workflow state in SQLite.
- [ ] Automated smoke coverage verifies the full graph.

## Phase 9: Enforce The Final Boundary

Goal: turn the architecture from documentation into a continuously enforced
contract.

Checklist:

- [x] Update `tools/check-architecture.mjs` for the `src/main/api`,
  `src/main/internal`, `electron/preload.cts`, `src/renderer`, and `src/shared`
  layout.
- [x] Remove obsolete roots from the checker such as legacy `domain`,
  `infrastructure`, `core`, and renderer `src` paths after migration.
- [x] Make `pnpm run check:architecture` pass in full.
- [x] Keep `pnpm run check:architecture:staged` in commit hooks.
- [ ] Add unit tests for pure domain services and state graphs.
- [ ] Add integration tests for repositories, transactions, migrations, vault
  unlock/save/import/export, and API route handlers.
- [ ] Add an Electron smoke test for setup, unlock, target creation, session
  start, stimulation-set logging, session end, export, and import.
- [ ] Add an Electron smoke test for the full session state-machine flow.
- [ ] Extend `tools/check-architecture.mjs` or add a targeted static check so
  renderer code cannot call graph-bypassing session mutation routes for workflow
  actions.

Exit criteria:

- [x] `pnpm run build` passes.
- [x] `pnpm run check:architecture` passes.
- [ ] Test coverage exists at service, repository, migration, route-handler, and
  smoke-test levels.
- [ ] UI state-machine coverage exists for the full graph.
- [ ] The implemented directory tree matches `docs/architecture.md`.

## Suggested Commit Cadence

Use one commit per small migration step. Example messages:

- `Update architecture target layout`
- `Introduce main API skeleton`
- `Move main startup orchestration`
- `Add route registry module`
- `Move SQLite store core`
- `Move target domain routes`
- `Decouple preload transport`
- `Restore migrated build`
