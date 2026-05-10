# ADR 0003: SQLite Storage Before Encryption

## Status

Accepted

## Context

The MVP initially persisted a single plaintext JSON file. The product needs encrypted local storage, but encrypting a JSON file first and then moving to SQLite later would create extra migration work and a temporary double-encryption risk.

## Decision

Move persistence to SQLite before adding encryption.

The app stores a relational SQLite database at `emdr-local.sqlite` in Electron's app-data directory. The current renderer still works with a full application data object, while the Electron main process maps that object into normalized SQLite tables.

The schema includes:

- `app_metadata`
- `target_versions`
- `sessions`
- `stimulation_sets`
- `settings`

If a legacy MVP JSON database exists and no SQLite database exists yet, the Electron main process migrates that JSON data into SQLite on first load.

## Consequences

- Encryption can later wrap one SQLite database file.
- Session, target, stimulation, and settings data have explicit relational tables.
- The UI does not need to change during this storage migration.
- The current save path rewrites the full app data snapshot into SQLite. More granular writes can be added later if the data volume requires it.
