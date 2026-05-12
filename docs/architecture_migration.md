# Architecture Migration Plan

This plan migrates the current codebase toward the architecture specified in
[architecture.md](architecture.md). It is based on the repository state reviewed
on 2026-05-11.

## Current Baseline

The target architecture is now:

```text
electron/main.ts
  -> src/main/api
  -> src/main/internal/domain/*
  -> src/main/internal/lib/*
```

The main API layer owns startup, module wiring, and the route registry. Domains
self-register their IPC endpoints with that registry. Preload is a
domain-agnostic bridge and does not know which routes exist.

The current codebase is partway through that migration:

- `electron/main.ts` owns Electron lifecycle, network blocking, native dialogs,
  vault commands, generic database IPC, and store calls in one file.
- `electron/preload.cts` exposes a generic request/subscription bridge.
- `domain/*` contains a mix of domain entities, services, repositories,
  factories, and React components.
- `domain/app/components/AnimatedApp.tsx` owns the authoritative in-memory
  `Database`, creates targets, starts sessions, logs stimulation sets, updates
  settings, and saves the whole snapshot.
- `src/db.ts` is a renderer-side store adapter with an Electron IPC path and a
  `localStorage` fallback.
- `src/main/internal/lib/store/sqlite/app-store.ts` keeps vault unlock state and
  encrypted save behavior, while
  `src/main/internal/lib/store/sqlite/app-database.ts` owns migrations and the
  repository-backed full database snapshot mapping.
- Domain services and repositories exist under `src/main/internal/domain`, but
  the renderer still relies on transitional full-snapshot load/save routes for
  several workflows.
- The agent sidecar is documented but not implemented.

Baseline command results:

- `pnpm run build` fails because several renderer components still import service
  functions that were replaced by service classes.
- `pnpm run check:architecture` fails with 46 violations, mostly from renderer
  business logic, generic database IPC, renderer store access, factories outside
  service files, and mixed type/runtime modules.
- `git status --short --branch` is clean except for untracked `.claude/`.

## Migration Rules

- Migrate structure first, then restore the build.
- Preserve encrypted vault compatibility unless a deliberate vault migration is
  added and tested.
- Preserve SQLite migrations. Do not edit applied migrations to change behavior;
  add new versioned migrations.
- Keep the app local-only. Electron should continue blocking remote content.
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

- [x] Add a small module shape for main-process domains, for example
  `Name()` and `Register(registry)`.
- [x] Move vault IPC registration into `src/main/internal/domain/vault/ipc.ts`.
- [x] Add target routes for list, create, and revise.
- [x] Add session routes for start, assessment update, flow transition, and end.
- [x] Add stimulation-set routes for logging and listing by session.
- [x] Add setting routes for read and bilateral-stimulation update.
- [ ] Validate route payloads at the domain IPC boundary.
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
- [x] Move app, vault, target, session, stimulation-set, and setting domains to
  `src/main/internal/domain/<domain>`.
- [ ] Move guide domain to
  `src/main/internal/domain/<domain>`.
- [x] Keep repositories in their owning domain folders.
- [x] Keep generic SQL adapter abstractions in `src/main/internal/lib/store`.
- [x] Split `src/main/internal/lib/store/sqlite/app-store.ts` into vault-backed
  store lifecycle and repository-backed app database mapping.
- [ ] Replace full-snapshot `replaceAll` persistence with granular repository
  writes for command handlers.
  - [x] Target routes write through `TargetService` and the target repository.
  - [ ] Session routes write through `SessionService` and session repositories.
  - [x] Stimulation-set routes write through `StimulationSetService` and the
    stimulation-set repository.
  - [x] Setting routes write through `SettingService` and the setting repository.
- [x] Add transaction helpers for workflows that update multiple tables.

Exit criteria:

- [ ] Only repositories and generic store infrastructure import `sql.js`.
- [ ] No renderer or preload code imports main internals or store modules.
- [ ] Domain-specific SQL and mappings live with the owning domain.
- [x] Legacy `core/internal` store and vault paths are removed or reduced to
  temporary shims.

## Phase 5: Decouple Preload And Renderer

Goal: make preload a domain-agnostic bridge and React presentation-only.

Checklist:

- [x] Replace domain-specific preload methods with generic request and
  subscription functions.
- [x] Ensure preload imports no domain endpoint definitions.
- [ ] Create `src/renderer/app` for React root, layout, providers, and top-level
  screen composition.
- [ ] Move UI from `domain/*/components` to `src/renderer/features/<feature>`.
- [ ] Move Pixi/animation code from `src/animation` into renderer guide or room
  feature folders.
- [ ] Replace renderer imports from domain factories and services with
  transport-backed feature clients or presentation-only helpers.
- [ ] Remove `src/db.ts` and the `localStorage` fallback.
- [ ] Keep renderer state limited to form drafts, selected panels, animation
  state, transient chat input, loading state, and error display.

Exit criteria:

- [ ] Preload has no domain-specific route list.
- [ ] `src/renderer` does not import `src/main`, `core`, `electron`,
  repositories, factories, or main-process services.
- [ ] React components do not construct domain records or mutate authoritative
  collections.

## Phase 6: Restore Buildable State

Goal: after the structural migration, make the app compile and remove temporary
compatibility code.

Checklist:

- [ ] Replace renderer imports of removed service functions with migrated route
  calls or renderer-local helpers.
- [ ] Move direct `nowIso`, target creation, session creation, stimulation-set
  creation, and settings mutation out of React components.
- [ ] Remove direct renderer collection mutation of the authoritative `Database`.
- [ ] Preserve behavior for target creation, target revision, session start/end,
  stimulation-set logging, settings changes, vault setup, unlock, import, and
  export.
- [ ] Delete transitional route aliases and legacy import shims.
- [ ] Run `pnpm run build`.
- [ ] Run `pnpm run check:architecture:staged` before each commit.

Exit criteria:

- [ ] `pnpm run build` succeeds.
- [ ] New or changed TypeScript files pass the staged architecture check.
- [ ] Existing full architecture violations are reduced to only planned
  follow-up work.

## Phase 7: Add Agent Infrastructure

Goal: implement the local guide sidecar without weakening the main-process
authority boundary.

Checklist:

- [ ] Add `src/main/internal/lib/agent` for sidecar startup, shutdown, health
  checks, transport, and model runtime configuration.
- [ ] Add `src/main/internal/domain/guide` for guide prompts, structured action
  schemas, action validation, and guide-specific state.
- [ ] Route agent proposed actions through the same domain services used by human
  UI commands.
- [ ] Reject invalid agent actions in main before any mutation.
- [ ] Ensure the agent never imports renderer code, repositories, SQLite code, or
  Electron IPC.
- [ ] Add tests for allowed and rejected guide actions per session state.

Exit criteria:

- [ ] Agent output is advisory and structured.
- [ ] Main process remains the only state mutator.
- [ ] Renderer displays guide messages and proposed edits from main-process view
  events.

## Phase 8: Enforce The Final Boundary

Goal: turn the architecture from documentation into a continuously enforced
contract.

Checklist:

- [ ] Update `tools/check-architecture.mjs` for the final `src/main/api`,
  `src/main/internal`, `src/preload`, `src/renderer`, and `src/shared` layout.
- [ ] Remove obsolete roots from the checker such as legacy `domain`,
  `infrastructure`, `core`, and renderer `src` paths after migration.
- [ ] Make `pnpm run check:architecture` pass in full.
- [ ] Keep `pnpm run check:architecture:staged` in commit hooks.
- [ ] Add unit tests for pure domain services and state graphs.
- [ ] Add integration tests for repositories, transactions, migrations, vault
  unlock/save/import/export, and API route handlers.
- [ ] Add an Electron smoke test for setup, unlock, target creation, session
  start, stimulation-set logging, session end, export, and import.

Exit criteria:

- [ ] `pnpm run build` passes.
- [ ] `pnpm run check:architecture` passes.
- [ ] Test coverage exists at service, repository, migration, route-handler, and
  smoke-test levels.
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
