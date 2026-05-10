# ADR 0001: Clinical Evidence Policy

## Status

Accepted

## Context

The app supports EMDR-related workflows and may eventually make product decisions based on clinical evidence. Those decisions must be explicit and reviewable in the repository.

The initial sources reviewed were:

- VA National Center for PTSD, "Eye Movement Desensitization and Reprocessing for PTSD": https://www.ptsd.va.gov/professional/treat/txessentials/emdr_pro.asp
- VA National Center for PTSD, patient-facing EMDR overview: https://www.ptsd.va.gov/understand_tx/emdr.asp
- NICE guideline NG116, PTSD recommendations: https://www.nice.org.uk/guidance/ng116/chapter/Recommendations
- WHO mhGAP evidence centre, PTSD psychological interventions for adults: https://www.who.int/teams/mental-health-and-substance-use/treatment-care/mental-health-gap-action-programme/evidence-centre/conditions-related-to-stress/posttraumatic-stress-disorder-%28ptsd%29--psychological-interventions---adults
- Cochrane, "Psychological therapies for chronic post-traumatic stress disorder (PTSD) in adults": https://www.cochrane.org/evidence/CD003388_psychological-therapies-chronic-post-traumatic-stress-disorder-ptsd-adults

These sources support EMDR as an evidence-based psychological therapy for PTSD in clinical contexts. They do not, by themselves, define the safest or most effective implementation details for an unsupervised desktop application.

## Decision

Any future workflow decision that claims to be clinically optimized must get its own ADR before implementation.

For the MVP, the app will avoid strong clinical optimization claims. It will implement a basic local session flow, local target tracking, and visual bilateral stimulation.

## Consequences

- Clinical claims and workflow defaults are not hidden in code comments or UI copy.
- Future changes such as required phase order, scoring prompts, session cadence, target completion heuristics, and bilateral stimulation parameters must cite reviewed sources.
- The MVP can be built while leaving disputed or under-researched workflow details configurable or minimal.
