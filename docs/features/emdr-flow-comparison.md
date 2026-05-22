# Feature: EMDR Flow Comparison

## Status

Research and state inventory only. No implementation decision is made here.

## Scope

This document compares a research-backed EMDR therapy flow against the current
app state graphs so product and clinical decisions can be made explicitly before
code changes.

Important constraint: the research sources describe clinician-delivered EMDR.
They do not, by themselves, authorize an unsupervised desktop app to claim that
it provides EMDR therapy. Future workflow changes that make clinical claims
should follow [ADR 0001](../adr/0001-clinical-evidence-policy.md).

No database schema or endpoint schema changes are proposed in this document.

## Sources Reviewed

- EMDRIA, "The Eight Phases of EMDR Therapy":
  https://www.emdria.org/blog/the-eight-phases-of-emdr-therapy/
- EMDRIA, "EMDRIA Definition of EMDR":
  https://www.emdria.org/wp-content/uploads/2020/04/EMDRIADefinitionofEMDR.pdf
- VA National Center for PTSD, "Eye Movement Desensitization and Reprocessing
  for PTSD": https://www.ptsd.va.gov/professional/treat/txessentials/emdr_pro.asp
- NICE NG116 PTSD recommendations:
  https://www.nice.org.uk/guidance/ng116/chapter/Recommendations

The sources are consistent on the core structure: EMDR is phased, preparation
and stabilization happen before target processing, target assessment captures
image/cognition/SUD/VOC/body data, bilateral stimulation happens in sets with
periodic review, closure happens at the end of processing sessions whether or
not processing is complete, and reevaluation starts later sessions.

## Researched EMDR Flow

```mermaid
flowchart TD
  history["1. History and treatment planning"]
  preparation["2. Preparation and stabilization"]
  ready{"Ready for target processing?"}
  assessment["3. Target assessment<br/>image, negative cognition, positive cognition, VOC, emotions, SUD, body location"]
  desensitization["4. Desensitization<br/>BLS sets while focused on target"]
  reduced{"SUD reduced enough?"}
  grounding{"Needs grounding or containment?"}
  installation["5. Installation<br/>strengthen positive cognition with BLS"]
  installed{"VOC strong enough?"}
  bodyScan["6. Body scan<br/>check residual somatic disturbance"]
  bodyClear{"Body clear?"}
  closure["7. Closure<br/>stabilize before ending session"]
  reevaluation["8. Reevaluation<br/>begin next session by checking prior work"]
  moreTargets{"More past, present, or future targets?"}
  complete["Treatment target complete or pause care plan"]

  history --> preparation
  preparation --> ready
  ready -- "no" --> preparation
  ready -- "yes" --> assessment
  assessment --> desensitization
  desensitization --> reduced
  reduced -- "no" --> grounding
  grounding -- "yes" --> closure
  grounding -- "no" --> desensitization
  reduced -- "yes" --> installation
  installation --> installed
  installed -- "no" --> installation
  installed -- "yes" --> bodyScan
  bodyScan --> bodyClear
  bodyClear -- "no" --> desensitization
  bodyClear -- "yes" --> closure
  closure --> reevaluation
  reevaluation --> moreTargets
  moreTargets -- "yes" --> assessment
  moreTargets -- "needs stabilization" --> preparation
  moreTargets -- "no" --> complete
```

## Current Session Flow

Source of truth: [flow.ts](../../src/main/internal/domain/session/flow.ts).

```mermaid
flowchart TD
  idle["idle"]
  targetSelection["target_selection"]
  preparation["preparation"]
  stimulation["stimulation"]
  interjection["interjection"]
  closure["closure"]
  review["review"]
  postSession["post_session"]

  idle -- "start_session" --> targetSelection
  idle -- "select_target" --> preparation
  targetSelection -- "select_target" --> preparation
  targetSelection -- "create_target_draft" --> targetSelection
  targetSelection -- "return_to_idle" --> idle
  preparation -- "update_assessment" --> preparation
  preparation -- "approve_assessment" --> stimulation
  preparation -- "request_grounding" --> interjection
  preparation -- "begin_closure" --> closure
  stimulation -- "start_stimulation" --> stimulation
  stimulation -- "log_stimulation_set" --> stimulation
  stimulation -- "pause_stimulation" --> interjection
  stimulation -- "request_grounding" --> interjection
  stimulation -- "begin_closure" --> closure
  interjection -- "continue_stimulation" --> stimulation
  interjection -- "request_grounding" --> interjection
  interjection -- "begin_closure" --> closure
  closure -- "request_review" --> review
  closure -- "continue_stimulation" --> stimulation
  closure -- "request_grounding" --> interjection
  review -- "close_session" --> postSession
  review -- "begin_closure" --> closure
  postSession -- "return_to_idle" --> idle
  postSession -- "start_session" --> targetSelection
```

Current persistence recovery also matters: an unfinished session with no logged
sets is recovered into `preparation`; an unfinished session with any logged set
is recovered into `interjection`. More specific clinical phase position is not
durable today.

## Current Animated Room States

Source of truth:
[animatedRoomMachine.ts](../../src/renderer/app/animatedRoomMachine.ts).
This chart reflects reducer semantics. Some events are only dispatched from
specific UI controls.

```mermaid
flowchart TD
  guide["guide<br/>panel: chat"]
  idle["idle<br/>panel: none"]
  targets["targets<br/>panel: targets"]
  history["history<br/>panel: history"]
  settings["settings<br/>panel: settings"]
  stimulation["stimulation<br/>panel: none, BLS running"]
  stimulationSettings["stimulation_settings<br/>panel: settings, BLS running"]

  guide -- "select_targets" --> targets
  guide -- "select_history" --> history
  guide -- "select_settings" --> settings
  guide -- "close_panel" --> idle
  idle -- "select_guide" --> guide
  idle -- "select_targets" --> targets
  idle -- "select_history" --> history
  idle -- "select_settings" --> settings
  targets -- "select_guide" --> guide
  targets -- "select_history" --> history
  targets -- "select_settings" --> settings
  targets -- "close_panel" --> idle
  history -- "select_guide" --> guide
  history -- "select_targets" --> targets
  history -- "select_settings" --> settings
  history -- "close_panel" --> idle
  settings -- "select_guide" --> guide
  settings -- "select_targets" --> targets
  settings -- "select_history" --> history
  settings -- "close_panel" --> idle
  guide -- "start_stimulation" --> stimulation
  idle -- "start_stimulation" --> stimulation
  targets -- "start_stimulation" --> stimulation
  history -- "start_stimulation" --> stimulation
  settings -- "start_stimulation" --> stimulation
  stimulation -- "select_settings" --> stimulationSettings
  stimulation -- "select_guide / select_targets / select_history" --> stimulation
  stimulation -- "pause_stimulation" --> guide
  stimulation -- "close_panel" --> idle
  stimulation -- "reset_room" --> guide
  stimulationSettings -- "close_panel" --> stimulation
  stimulationSettings -- "select_guide / select_targets / select_history / select_settings" --> stimulationSettings
  stimulationSettings -- "pause_stimulation" --> guide
  stimulationSettings -- "reset_room" --> guide
```

While stimulation is running, selecting guide, targets, or history leaves the
room in the running state. Selecting settings moves to `stimulation_settings`.
The reducer also treats `reset_room`, `start_stimulation`, and
`pause_stimulation` as global events, regardless of the current state.

## Current-To-Research Mapping

| Research phase | Current support | Gap |
| --- | --- | --- |
| History and treatment planning | Targets can be created and selected. | No explicit history, readiness, treatment-plan, risk, or clinician-supervision gate. |
| Preparation and stabilization | `preparation`; `request_grounding`; guide chat can propose actions. | Preparation is not distinct from assessment, readiness is not modeled, and stabilization resources are not first-class. |
| Target assessment | `AssessmentForm` captures image, negative cognition, positive cognition, VOC, emotions, SUD, and body location. | Assessment can be approved without documented readiness criteria, and "Start Set" can implicitly approve assessment. |
| Desensitization | `stimulation`, `log_stimulation_set`, `pause_stimulation`, `interjection`. | No separate desensitization phase, SUD threshold, blocked/complete target decision, or between-set clinical decision model. |
| Installation | Not distinct. | Positive cognition strengthening is not modeled separately from stimulation. |
| Body scan | Initial body location is captured in assessment. | No post-installation body scan state or residual-disturbance loop. |
| Closure | `closure`, `request_review`, and session end from `review`. | Closure is optional until the user or guide chooses it; no enforced closure after activated material or before ending app work. |
| Reevaluation | `review` and `post_session` exist. | `review` is current-session closeout, not phase 8 reevaluation at the next session start. |
| Three-pronged protocol | Targets can recur across sessions. | Past events, present triggers, and future templates are not represented as target categories or progression. |

## Likely Change Areas

These are candidates for product and clinical review, not implementation tasks
yet:

- Split `preparation` into explicit preparation/readiness and target assessment
  states, or keep one state but add a documented readiness gate before
  `approve_assessment`.
- Split broad `stimulation` into desensitization, installation, and body-scan
  states if the product intends to model the standard protocol instead of a
  simpler EMDR-informed set tracker.
- Require closure after processing has started before a session can be closed
  or abandoned.
- Recast `review` as current-session summary and add a separate next-session
  `reevaluation` step before returning to target assessment or preparation.
- Decide whether targets need protocol prongs: past memory, present trigger,
  future template. This may require schema changes and must not be implemented
  without explicit approval.
- Make room state orthogonal as already noted in
  [state-graph-simplification.md](state-graph-simplification.md): panel state
  and stimulation running state should be separate facts.
- Decide whether workflow phase should be durable. Current recovery collapses
  active sessions into `preparation` or `interjection`, which may be too coarse
  if more clinical phases are added.

## Open Questions

- Is the app trying to implement a clinical EMDR protocol, or an EMDR-informed
  local support tool with explicit non-clinical limits?
- Should a user be able to start BLS from `preparation`, or should BLS require a
  completed target assessment and an explicit readiness confirmation?
- Should the app support incomplete processing between sessions as a first-class
  state, including next-session reevaluation?
- Should future implementation require clinician mode, supervision language, or
  stronger safety gates before protocol-like flows are exposed?
