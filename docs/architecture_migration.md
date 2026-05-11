# Architecture Migration Plan

This plan migrates the current codebase toward the architecture specified in
[architecture.md](architecture.md). It is based on the repository state reviewed on
2026-05-11.

## Current Baseline

The target architecture is clear: Electron main is the Core Engine, preload is a
narrow typed bridge, React is presentation only, SQL is reached only through
main-process domain repositories, and the future agent is advisory.

The current codebase is partway through that migration:

- `electron/main.ts` owns Electron lifecycle, network blocking, native dialogs,
  vault commands, generic database IPC, and persistence calls in one file.
- `electron/preload.cts` exposes `db:load` and `db:save`, which sends a full
  application database snapshot across IPC.
- `domain/*` contains a mix of domain entities, services, repositories, factories,
  and React components.
- `domain/app/components/AnimatedApp.tsx` owns the authoritative in-memory
  `Database`, creates targets, starts sessions, logs stimulation sets, updates
  settings, and saves the whole snapshot.
- `src/db.ts` is a renderer-side persistence adapter with an Electron IPC path and
  a `localStorage` fallback.
- `core/internal/sqlite/app-store.ts` composes vault unlock state, SQLite lifecycle,
  migrations, full database snapshot mapping, repository construction, and
  encrypted save behavior.
- Domain services and repositories exist, but the renderer still bypasses them for
  many workflows, and main-process IPC does not yet route through domain-specific
  handlers.
- The agent sidecar is documented but not implemented.

Baseline command results:

- `pnpm run build` fails because several renderer components still import service
  functions that were replaced by service classes.
- `pnpm run check:architecture` fails with 46 violations, mostly from renderer
  business logic, generic database IPC, renderer persistence access, factories
  outside service files, and mixed type/runtime modules.
- `git status --short --branch` is clean except for untracked `.claude/`.

## Migration Rules

- Preserve encrypted vault compatibility unless a deliberate vault migration is
  added and tested.
- Preserve SQLite migrations. Do not edit applied migrations to change behavior;
  add new versioned migrations.
- Keep the app local-only. Electron should continue blocking remote content.
- Make each phase buildable before moving to the next phase.
- Commit after each coherent migration step with a 3-8 word message.
- Prefer moving behavior behind the future boundary before moving files, so path
  churn does not hide behavior changes.

## Phase 1: Restore A Buildable Baseline

Goal: make the current app compile without pretending the architectural migration
is complete.

Checklist:

- [ ] Replace renderer imports of removed service functions with current service
  APIs or focused transitional application-service functions.
- [ ] Move direct `nowIso`, target creation, session creation, stimulation-set
  creation, and settings mutation out of React components.
- [ ] Remove direct renderer collection mutation of the authoritative `Database`
  where a service method can express the intent.
- [ ] Keep runtime behavior equivalent for target creation, target revision,
  session start/end, stimulation-set logging, settings changes, vault setup,
  unlock, import, and export.
- [ ] Run `pnpm run build`.
- [ ] Run `pnpm run check:architecture:staged` before each commit.

Exit criteria:

- [ ] `pnpm run build` succeeds.
- [ ] New or changed TypeScript files pass the staged architecture check.
- [ ] Existing full architecture violations are documented and unchanged or
  reduced.

## Phase 2: Introduce Typed IPC Boundaries

Goal: replace generic database snapshot IPC with typed commands and view models
while the old directory layout can still exist.

Checklist:

- [ ] Add shared command, event, and view-model types under `src/shared`.
- [ ] Replace `db:load` and `db:save` with intent-specific commands:
  `target:list`, `target:create`, `target:revise`, `session:start`,
  `session:update-assessment`, `session:end`, `stimulation-set:log`,
  `settings:get`, and `settings:update-bilateral-stimulation`.
- [ ] Keep vault commands separate from domain data commands:
  `vault:status`, `vault:create`, `vault:unlock-password`,
  `vault:unlock-recovery`, `vault:export`, and `vault:import`.
- [ ] Add main-to-renderer events for view-state changes after mutations.
- [ ] Make preload expose typed methods and subscription helpers instead of raw
  `ipcRenderer.invoke` wrappers.
- [ ] Validate command payloads in main before calling services.
- [ ] Delete renderer access to the full `Database` snapshot once equivalent view
  models are available.

Exit criteria:

- [ ] No `db:*` channels remain.
- [ ] Renderer receives view models, not database rows or repository entities.
- [ ] Renderer subscriptions return unsubscribe functions.
- [ ] `pnpm run build` succeeds.

## Phase 3: Split Main App Composition From Domains

Goal: make the Electron main process the composition root and move
domain-specific behavior out of Electron shell code.

Checklist:

- [ ] Create `src/main/app` for Electron lifecycle, window creation, native
  dialogs, network guard setup, and dependency wiring.
- [ ] Move domain IPC registration out of `electron/main.ts` and into
  domain-owned IPC modules.
- [ ] Leave `electron/main.ts` as a small entrypoint until packaging is adjusted.
- [ ] Introduce a main-process application service that composes vault state,
  database state, repositories, domain services, and event publishing.
- [ ] Centralize IPC error mapping in `src/main/ipc`.
- [ ] Keep native dialogs in app-level adapters, not domain services.

Exit criteria:

- [ ] `electron/main.ts` contains only startup wiring.
- [ ] Domain command handlers call one domain service method each.
- [ ] Generic IPC infrastructure contains no domain channel names.

## Phase 4: Rehome Persistence And Repositories

Goal: align persistence ownership with the architecture document.

Checklist:

- [ ] Move generic SQLite connection, transaction, and migration runner code to
  `src/main/persistence`.
- [ ] Move domain repository interfaces and SQLite implementations under
  `src/main/domain/<domain>/repository` and
  `src/main/domain/<domain>/persistence`.
- [ ] Split `core/internal/sqlite/app-store.ts` into:
  - [ ] encrypted database load/save primitives;
  - [ ] database connection lifecycle;
  - [ ] migration execution;
  - [ ] domain repository factories;
  - [ ] app-level orchestration.
- [ ] Replace full-snapshot `replaceAll` persistence with granular repository
  writes for command handlers.
- [ ] Add transaction helpers for workflows that update multiple tables.
- [ ] Keep repository methods returning domain types, not raw SQLite rows.

Exit criteria:

- [ ] Only repositories and generic persistence infrastructure import `sql.js`.
- [ ] No renderer or preload code imports persistence modules.
- [ ] Domain-specific SQL and mappings live with the owning domain.
- [ ] Migration tests cover a fresh database and at least one existing vault
  database fixture.

## Phase 5: Move Renderer To Presentation-Only Features

Goal: make React own UI state only.

Checklist:

- [ ] Create `src/renderer/app` for React root, layout, providers, and top-level
  screen composition.
- [ ] Move UI from `domain/*/components` to `src/renderer/features/<feature>`.
- [ ] Move Pixi/animation code from `src/animation` into renderer guide or room
  feature folders.
- [ ] Replace renderer imports from `domain/*/factory`, `domain/*/service`, and
  `utils.ts` with preload API calls or renderer-local formatting helpers.
- [ ] Remove `src/db.ts` and the `localStorage` fallback.
- [ ] Keep renderer state limited to form drafts, selected panels, animation state,
  transient chat input, loading state, and error display.
- [ ] Render domain data from view models supplied by main-process events and
  command responses.

Exit criteria:

- [ ] `src/renderer` does not import `src/main`, `core`, `electron`, repositories,
  factories, or main-process services.
- [ ] React components do not construct domain records or mutate authoritative
  collections.
- [ ] Full `pnpm run check:architecture` violations for renderer business logic are
  gone.

## Phase 6: Normalize Main Domain Folders

Goal: make each domain deletable except for explicit callers.

Checklist:

- [ ] Move target, session, stimulation-set, settings, vault, and guide code under
  `src/main/domain/<domain>`.
- [ ] Use a consistent domain layout:
  `model`, `service`, `repository`, `persistence`, `ipc`, and `schemas`.
- [ ] Put domain-specific IPC definitions and handlers inside the owning domain.
- [ ] Put domain-specific persistence mappings inside the owning domain.
- [ ] Keep cross-domain calls service-to-service.
- [ ] Move shared type-only contracts that are safe across processes to
  `src/shared`.
- [ ] Split mixed type/runtime modules where the architecture check requires it.

Exit criteria:

- [ ] Removing one domain folder breaks only its callers.
- [ ] No repository imports another domain repository.
- [ ] Services know nothing about HTTP, Electron, React, dialogs, or the agent
  transport.

## Phase 7: Add Agent Infrastructure

Goal: implement the local guide sidecar without weakening the main-process
authority boundary.

Checklist:

- [ ] Add `src/main/agent` for sidecar startup, shutdown, health checks, transport,
  and model runtime configuration.
- [ ] Add `src/main/domain/guide` for guide prompts, structured action schemas,
  action validation, and guide-specific state.
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

- [ ] Update `tools/check-architecture.mjs` for the final `src/main`,
  `src/preload`, `src/renderer`, and `src/shared` layout.
- [ ] Remove obsolete roots from the checker such as legacy `domain`,
  `infrastructure`, and renderer `src` paths after migration.
- [ ] Make `pnpm run check:architecture` pass in full.
- [ ] Keep `pnpm run check:architecture:staged` in commit hooks.
- [ ] Add unit tests for pure domain services and state graphs.
- [ ] Add integration tests for repositories, transactions, migrations, vault
  unlock/save/import/export, and IPC command handlers.
- [ ] Add an Electron smoke test for setup, unlock, target creation, session
  start, stimulation-set logging, session end, export, and import.
- [ ] Remove transitional adapters and legacy imports.

Exit criteria:

- [ ] `pnpm run build` passes.
- [ ] `pnpm run check:architecture` passes.
- [ ] Test coverage exists at service, repository, migration, IPC, and smoke-test
  levels.
- [ ] The implemented directory tree matches `docs/architecture.md`.

## Suggested Commit Cadence

Use one commit per small migration step. Example messages:

- `Restore renderer service calls`
- `Add shared IPC contracts`
- `Split main IPC handlers`
- `Move SQLite persistence core`
- `Move target renderer feature`
- `Normalize session domain layout`
- `Add agent transport shell`
- `Enforce final architecture checks`
