# Architecture

EMDR Local is a local-first Electron desktop app with four runtime components:

```text
Agent process <----private protocol----> Electron main process <----Electron IPC----> Electron renderer
                                               |
                                               | repository calls
                                               v
                                           SQL store
```

The Electron main process is the Core Engine process. It owns authoritative
application state, domain workflows, store access, vault state, and agent
coordination.

The Electron renderer is the presentation layer. It renders UI, gathers user
input, and sends user intent to the main process through a preload-backed,
domain-agnostic transport bridge.

## Runtime Components

### Electron Main Process

The Electron main process is the application authority. It:

- owns the Core Engine
- owns domain workflows and state transitions
- owns vault unlock state
- starts and supervises the local agent process
- reads and writes the SQL store through repositories
- owns the API route registry for main-process IPC endpoints
- creates application windows and handles native desktop affordances

`electron/main.ts` is only the executable entrypoint. It should parse process
flags or environment needed at startup, then call `Start()` from
`src/main/api/app.ts`.

### Main API Layer

`src/main/api` is the main-process composition root. It sits between the
Electron entrypoint and `src/main/internal`.

It owns:

- application startup and shutdown
- Electron lifecycle wiring
- window creation setup
- network guard setup
- central IPC route registry setup
- domain module initialization
- dependency injection for store, repositories, services, vault, and agent
  adapters

The API layer is the only place that should know about all domains at once.

### Electron Preload

Preload is a narrow security bridge between the renderer and main process. It
runs in Electron's preload context, has access to `ipcRenderer`, and exposes a
small safe API to the renderer with `contextBridge`.

Preload is not the route registry and does not know which domains exist. It:

- exposes a domain-agnostic transport bridge to the renderer
- forwards renderer requests over generic main IPC transport
- forwards main events to renderer subscribers
- returns unsubscribe functions for subscriptions
- contains no business rules
- contains no route registration logic
- contains no domain-specific endpoint list
- contains no store, vault, or agent logic

### Electron Renderer

The renderer is the presentation layer. It:

- renders React UI and animation
- holds ephemeral UI state such as form drafts, selected panels, local input
  text, and animation state
- sends user intent through the preload bridge
- subscribes to main-process events and view state through the preload bridge
- never opens the store
- never talks to the agent process
- never owns authoritative domain state
- never imports main-process internals

### Agent Process

The agent process is a local sidecar. It:

- runs the local model runtime
- receives constrained context from the main process
- returns structured proposed actions
- never talks to the renderer
- never talks to the store
- never mutates state directly

The main process validates every proposed agent action before applying it.

### SQL Store

The SQL store is durable storage only. It:

- stores targets, sessions, stimulation sets, settings, and vault-backed app data
- is accessed only by the main process
- is reached through domain repositories
- is not exposed through generic renderer IPC

## Directory Structure

```text
electron/
  main.ts
  preload.cts

src/
  main/
    api/
      app.ts
      registry.ts
      modules.ts

    internal/
      domain/
        app/
        vault/
        target/
        session/
        stimulation-set/
        setting/
        guide/

      lib/
        ipc/
        store/
        vault/
        agent/
        electron/
        id/

  preload/
    app/

  renderer/
    app/
    features/
      vault/
      target/
      session/
      stimulation-set/
      setting/
      guide/

  shared/

agent/
docs/
assets/
```

## Directory Responsibilities

### `electron/main.ts`

Executable entrypoint only:

- parse startup flags and environment
- call `Start()` from `src/main/api/app.ts`
- contain no domain behavior
- contain no repository, store, or vault workflow logic
- contain no route registration logic beyond handing control to `src/main/api`

### `src/main/api/app.ts`

Main-process application lifecycle:

- start Electron app lifecycle
- configure network blocking
- create application windows through internal Electron adapters
- initialize the central API registry
- call `Initialize()` from `modules.ts`
- ask initialized modules to register their routes
- coordinate shutdown

### `src/main/api/registry.ts`

Central main-process route registry:

- defines the registration API used by domain modules
- owns generic renderer-to-main dispatch
- maps raw Electron IPC transport to registered route handlers
- maps handler errors to transport-safe errors
- publishes main-to-renderer events through generic IPC transport

Domain routes are registered here by modules, but domain-specific behavior does
not live here.

### `src/main/api/modules.ts`

Main-process dependency wiring:

- opens or receives the SQL store adapter
- instantiates repositories with the store adapter
- instantiates services with repositories and other service interfaces
- instantiates domain modules with their services
- returns the module list to `app.ts`

This is the only file that should stand up every domain at once.

### `src/main/internal/domain`

Core Engine domains. Each domain owns its bounded context:

```text
src/main/internal/domain/<domain>/
  module.ts
  ipc.ts
  service.ts
  repository.ts
  entity.ts
  types.ts
  factory.ts
  schemas.ts
```

The exact files may vary by domain, but the responsibilities do not:

- `module.ts` wires that domain's service, router/IPC registration, and public
  module shape
- `ipc.ts` registers that domain's endpoints with the central API registry
- `service.ts` owns business workflows and state transitions
- `repository.ts` is the only domain code that touches the store adapter
- `entity.ts` and `types.ts` define domain types
- `factory.ts` creates valid domain entities when a factory is useful
- `schemas.ts` validates boundary payloads when runtime validation is needed

Domains may depend on internal library abstractions and injected service
interfaces. They should not import renderer code, preload code, Electron shell
objects, or other domains' internals.

Cross-domain calls go service-to-service through injected interfaces.

### `src/main/internal/lib/ipc`

Generic IPC infrastructure:

- raw Electron IPC adapter helpers
- request and response envelope helpers
- subscription helper primitives
- transport-safe error helpers

Domain-specific routes do not live here. Route ownership belongs to
`src/main/api/registry.ts` and domain route registration belongs to each
domain's `ipc.ts`.

### `src/main/internal/lib/store`

Generic store infrastructure:

- SQL adapter abstraction
- SQLite connection lifecycle
- transactions
- migration runner
- low-level SQL utilities
- vault-backed database loading and saving primitives when they are generic

No domain-specific tables, queries, mappings, or business rules belong here.

### `src/main/internal/lib/vault`

Vault primitives:

- encryption and decryption helpers
- key wrapping helpers
- vault file parsing and writing
- vault format validation

Domain workflow around unlock, import, export, and status belongs to the vault
domain service.

### `src/main/internal/lib/agent`

Generic agent process infrastructure:

- sidecar process startup and shutdown
- stdio or localhost transport
- health checks
- model runtime configuration

Domain-specific guide behavior belongs in `src/main/internal/domain/guide`.

### `src/main/internal/lib/electron`

Electron shell adapters:

- window creation helpers
- dialog adapters
- native menu adapters
- network guard helpers

These adapters are infrastructure. They should not contain domain workflows.

### `src/preload/app`

Preload bridge setup:

- exposes domain-agnostic request and subscription functions
- wraps generic `ipcRenderer.invoke` transport
- wraps event subscription and unsubscription
- does not import domain endpoint definitions
- does not register routes

### `src/renderer/app`

Renderer application shell:

- React root
- top-level layout
- providers
- presentation-level routing or screen composition

### `src/renderer/features`

Renderer feature UI. These folders may mirror main domain names, but they
contain presentation code only.

### `src/shared`

Cross-process types and constants that are safe for both main and renderer.
Shared code must not import Electron main APIs, renderer APIs, store clients,
vault internals, or agent runtime code.

Shared code can define generic transport envelopes and serializable view-model
types. It should not become a back door for importing main internals into the
renderer.

## Dependency Direction

```text
electron/main.ts
  -> src/main/api/app.ts
  -> src/main/api/modules.ts
  -> src/main/internal/domain/*
  -> src/main/internal/lib/*

renderer
  -> preload bridge
  -> generic IPC transport
  -> src/main/api/registry.ts
  -> registered domain IPC handler
  -> domain service
  -> domain repository
  -> store adapter
```

Preload does not import domain modules. Domains do not import preload. The route
registry lives in main, and domain modules self-register with it during main
startup.

## IPC Shape

Renderer-to-main IPC is command based:

```text
renderer feature
  -> preload domain-agnostic transport
  -> generic main IPC transport
  -> src/main/api/registry.ts
  -> registered domain IPC handler
  -> domain service
```

Main-to-renderer IPC is event based:

```text
domain service or app coordinator
  -> registered main event publisher
  -> generic IPC event transport
  -> preload subscription
  -> renderer feature
```

IPC rules:

- no generic `db:load` or `db:save` channels
- no generic domain mutation channel that bypasses route registration
- the main route registry is owned by `src/main/api/registry.ts`
- domains register their own IPC endpoints during module registration
- preload exposes generic transport, not domain-specific endpoint wrappers
- renderer responses use view models, not database rows
- renderer subscriptions return unsubscribe functions

## Store Shape

Store access flows through domain repositories:

```text
domain service
  -> domain repository interface
  -> domain repository implementation
  -> generic store adapter
  -> SQL store
```

Store rules:

- generic store machinery lives in `src/main/internal/lib/store`
- domain-specific repositories live in `src/main/internal/domain/<domain>`
- domain-specific SQL mappings live with the owning domain repository
- the renderer never receives a store handle or full database snapshot

## Agent Shape

The guide domain owns agent-facing behavior:

```text
agent process
  -> generic main agent transport
  -> guide domain
  -> session domain
  -> validated state change
  -> renderer event
```

Agent rules:

- the agent process is advisory
- the main process is authoritative
- proposed agent actions are validated by domain services
- invalid proposed actions are rejected by the main process
- the agent never talks directly to renderer IPC or the store
