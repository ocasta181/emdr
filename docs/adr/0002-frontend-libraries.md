# ADR 0002: Frontend Libraries

## Status

Accepted

## Context

The app is an Electron desktop app with local file persistence. The first MVP needs a working end-to-end session flow more than a full client-state architecture.

Libraries considered:

- SWR: useful for remote request caching and revalidation.
- Zustand: useful for compact shared client state without large framework overhead.
- Tailwind CSS: useful for fast utility-first styling and consistent design tokens.

## Decision

Do not use SWR in the MVP because there is no remote data source and no server cache to revalidate.

Defer Zustand until session autosave, settings, and persistence state become more complex. The current React state is acceptable for the first end-to-end flow.

Defer Tailwind until the visual system stabilizes. The MVP uses plain CSS to avoid converting working styles before the product shape is clearer.

## Consequences

- The dependency surface stays small.
- Zustand remains the preferred next addition if state management starts spreading across components.
- Tailwind can be adopted later if the project wants utility-first styling.
