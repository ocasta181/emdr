# Architecture

EMDR Local is a hub-and-spoke desktop application. The Core Engine is the single source of truth for application state. All other components connect to it; none connect to each other.

```text
                    ┌─────────────────────┐
                    │   Presentation      │
                    │   (Electron renderer,│
                    │    React UI)        │
                    └────────┬────────────┘
                             │ Electron IPC
                             │ (bidirectional)
                             │
┌──────────────┐    ┌────────┴────────────┐    ┌──────────────────┐
│  Agent       │────│   Core Engine       │────│  Persistence     │
│  (llama.cpp  │    │   (Electron main    │    │  (encrypted      │
│   sidecar)   │    │    process)         │    │   SQLite)        │
└──────────────┘    └─────────────────────┘    └──────────────────┘
     stdio/local HTTP       │
                            │ single source of truth
```

## Components

### Core Engine

The Core Engine runs in the Electron main process. It is the coordination layer and single source of truth for application state. It:

- owns all application state
- performs CRUD operations against the Persistence layer via repositories and services
- sends prompts to and receives structured actions from the Agent layer
- receives user actions from the Presentation layer via IPC
- pushes state updates and agent actions to the Presentation layer via IPC

No other component may access the database, talk to the agent, or hold authoritative state.

### Presentation Layer

The Presentation layer is the Electron renderer process running React. It handles display logic only. It:

- renders UI based on state pushed from the Core Engine
- sends user actions to the Core Engine via IPC
- never holds a database reference or database aggregate in memory
- never calls repositories or services directly
- never communicates with the Agent layer

Communication is bidirectional over Electron IPC:

- **Renderer to Main** (`ipcRenderer.invoke`): request/response for user-initiated actions (create target, start session, etc.)
- **Main to Renderer** (`webContents.send`): push events for state changes, agent actions, and real-time updates (no polling required)

### Agent Layer

The Agent layer is a local llama.cpp sidecar process. It runs a quantized LLM that acts as the Guide, handling structured decision-making within the session flow. It:

- runs as a separate OS process, started and stopped by the Core Engine
- communicates with the Core Engine over stdio or a localhost-bound HTTP endpoint
- receives a constrained prompt context and a list of allowed actions
- returns structured action requests (not free-form mutations)
- never touches the database, the UI, or the network

The Core Engine validates every action the Agent proposes against the current session state before applying it. The Agent cannot bypass the deterministic state machine. See [docs/features/agent.md](features/agent.md) for the full agent specification.

### Persistence Layer

The Persistence layer is an encrypted local SQLite database stored inside a vault file. It:

- is the only durable store for targets, sessions, stimulation sets, and settings
- is accessed exclusively through typed repositories
- is encrypted at rest with AES-256-GCM
- requires vault unlock (password or recovery key) before any reads or writes
- runs migrations on schema changes

## Layering Rules

```text
SqliteDatabase ──DI──▶ Repository ──used by──▶ Service ──exposed via IPC──▶ UI
```

1. **Repositories** are the only code that touches the database. The database connection is dependency-injected.
2. **Services** depend on repositories (DI). They implement business logic and return domain entities. They never import or reference the database connection.
3. **IPC handlers** (in the Core Engine) wire services to Electron IPC channels. Each domain operation is exposed as a named channel.
4. **The renderer** calls thin IPC proxy functions. It never imports services, repositories, or database types.

## IPC Channel Convention

Channels follow a `domain:action` naming pattern, consistent with the existing vault channels:

```text
vault:status, vault:create, vault:unlock-password, ...
target:list, target:add, target:update, ...
session:start, session:end, ...
setting:get, setting:update, ...
```

A shared TypeScript channel map defines the request and response types for every channel, enforcing type safety across the main and renderer processes.

## Directory Structure

```text
domain/                  Business logic, organized by domain concept
  app/                   App-level types, state machine, UI shell
  session/               Session entity, service, state machine, flow
  target/                Target entity, versioning, service
  setting/               Settings entity, service
  stimulation-set/       Stimulation set entity
  vault/                 Vault UI components

infrastructure/          Data and platform concerns
  security/              Vault encryption, key derivation
  sqlite/                SQLite connection, base repository, migrations

electron/                Electron main process and preload
  main.ts                IPC handler registration, app lifecycle
  preload.cts            Context bridge exposing IPC to renderer

src/                     Renderer-only code (React, animation, styles)
```

## Data Flow Examples

### User creates a target

```text
Renderer                Core Engine              Persistence
   │                         │                        │
   ├─invoke("target:add")──▶│                        │
   │                         ├─TargetService.add()───▶│
   │                         │                        ├─TargetRepo.insert()
   │                         │                        │  └─ SQL INSERT
   │                         │◀── Target ────────────┤
   │◀── Target ─────────────┤                        │
```

### Agent proposes an action during a session

```text
Agent                   Core Engine              Renderer
  │                         │                        │
  │◀─ prompt context ──────┤                        │
  ├─ action request ──────▶│                        │
  │                         ├─ validate action       │
  │                         ├─ apply state change    │
  │                         ├─send("session:update")▶│
  │                         │                        ├─ re-render
```
