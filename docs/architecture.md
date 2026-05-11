# Architecture

EMDR Local is a local-first Electron desktop app with four runtime components:

```text
Agent process <----private protocol----> Electron main process <----Electron IPC----> Electron renderer
                                               |
                                               | repository calls
                                               v
                                           SQL database
```

The Electron main process is the Core Engine process. It owns the authoritative application state, domain workflows, persistence access, vault state, and agent coordination.

The Electron renderer is the presentation layer. It renders UI, gathers user input, and sends user intent to the main process through preload-backed IPC.

## Runtime Components

### Electron Main Process

The Electron main process is the application authority. It:

- owns the Core Engine
- owns domain workflows and state transitions
- owns vault unlock state
- starts and supervises the local agent process
- reads and writes the SQL database through repositories
- exposes typed command/event IPC to the renderer
- creates application windows and handles native desktop affordances

The main process may contain Electron shell code, but domain-specific behavior belongs under `src/main/domain`.

### Electron Preload

Preload is a narrow security bridge between the renderer and main process. It:

- exposes a small typed API to the renderer with `contextBridge`
- forwards renderer commands to main IPC
- forwards main events to renderer subscribers
- contains no business rules
- contains no persistence or agent logic

### Electron Renderer

The renderer is the presentation layer. It:

- renders React UI and animation
- holds ephemeral UI state such as form drafts, selected panels, local input text, and animation state
- calls preload APIs to express user intent
- subscribes to main-process events and view state
- never opens the database
- never talks to the agent process
- never owns the authoritative domain state

### Agent Process

The agent process is a local sidecar. It:

- runs the local model runtime
- receives constrained context from the main process
- returns structured proposed actions
- never talks to the renderer
- never talks to the database
- never mutates state directly

The main process validates every proposed agent action before applying it.

### SQL Database

The SQL database is durable storage only. It:

- stores targets, sessions, stimulation sets, settings, and vault-backed app data
- is accessed only by the main process
- is reached through domain repositories
- is not exposed through generic renderer IPC

## Directory Structure

```text
src/
  main/
    app/
    domain/
      vault/
      target/
      session/
      stimulation-set/
      settings/
      guide/
    ipc/
    persistence/
    agent/

  preload/
    app/

  renderer/
    app/
    features/
      vault/
      target/
      session/
      stimulation-set/
      settings/
      guide/

  shared/

agent/
database/
docs/
assets/
```

## Directory Responsibilities

### `src/main/app`

Main-process application composition:

- Electron lifecycle
- window creation
- native menus and dialogs
- wiring domains to persistence, IPC, and agent adapters

### `src/main/domain`

Core Engine domains. This is where domain-specific application behavior lives.

Each domain owns its vertical slice:

```text
src/main/domain/<domain>/
  model/
  service/
  repository/
  persistence/
  ipc/
  schemas/
```

Domain-specific IPC definitions and handlers live inside the domain. Domain-specific persistence definitions, mappings, and repository implementations live inside the domain. The domain service owns the business workflow.

### `src/main/ipc`

Generic IPC infrastructure only:

- typed registration helpers
- command dispatch helpers
- event publishing helpers
- shared IPC error mapping

No domain-specific channels belong here.

### `src/main/persistence`

Generic persistence infrastructure only:

- database connection lifecycle
- transactions
- migration runner
- low-level SQL utilities
- vault-backed database loading and saving primitives

No domain-specific tables, queries, or mappings belong here.

### `src/main/agent`

Generic agent process infrastructure only:

- sidecar process startup and shutdown
- stdio or localhost transport
- health checks
- model runtime configuration

Domain-specific guide behavior belongs in `src/main/domain/guide`.

### `src/preload/app`

Preload bridge setup:

- exposes the approved renderer API
- wraps `ipcRenderer.invoke`
- wraps event subscription and unsubscription

### `src/renderer/app`

Renderer application shell:

- React root
- top-level layout
- providers
- presentation-level routing or screen composition

### `src/renderer/features`

Renderer feature UI. These folders may mirror main domain names, but they contain presentation code only.

### `src/shared`

Cross-process types and constants that are safe for both main and renderer. Shared code must not import Electron main APIs, renderer APIs, database clients, or agent runtime code.

## IPC Shape

Renderer-to-main IPC is command based:

```text
renderer feature
  -> preload app API
  -> generic main IPC transport
  -> domain-specific IPC handler
  -> domain service
```

Main-to-renderer IPC is event based:

```text
domain service
  -> domain event
  -> generic main IPC event publisher
  -> preload subscription
  -> renderer feature
```

IPC rules:

- no generic `db:load` or `db:save` channels
- no generic domain mutation channel
- one typed command per user intent
- domain-specific command definitions live in `src/main/domain/<domain>/ipc`
- renderer responses use view models, not database rows
- renderer subscriptions return unsubscribe functions

## Persistence Shape

Persistence flows through domain repositories:

```text
domain service
  -> domain repository interface
  -> domain persistence implementation
  -> generic persistence connection
  -> SQL database
```

Persistence rules:

- generic DB machinery lives in `src/main/persistence`
- domain-specific repositories live in `src/main/domain/<domain>/repository`
- domain-specific SQL mappings live in `src/main/domain/<domain>/persistence`
- the renderer never receives a database handle or full database snapshot

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
- the agent never talks directly to renderer IPC or persistence
