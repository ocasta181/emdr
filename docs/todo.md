# Manual QA Todo

Manual UI pass run on May 12, 2026 with a fresh encrypted local profile.

## Bugs

- [x] Vault import/unlock must clear transient renderer state. Importing while a session/stimulation is active can return to the unlocked app with stale room state and the stimulation ball still running.
- [x] Opening Guide during active stimulation must go through the session workflow. It currently can stop the visible stimulation UI without clearly logging or preserving the active set.
- [x] The room Settings hotspot must open settings when stimulation is not running.
- [x] History session summaries need cleaner wording. The manual pass showed awkward set pluralization.
- [x] Export/import needs visible success or cancellation feedback.
- [x] History needs complete outcome data. Final SUD is only shown when the session already has one; the review/end-session UI does not collect it.

## Missing Flows

- [x] Add an explicit Lock action for normal user-initiated vault locking.
- [x] Add a recovery-key save/copy/confirmation step during setup.
- [ ] Expand guide proposal handling beyond the current scripted log-set/end-session prompts.
- [ ] Tighten target validation if description, cognitions, or SUD values are intended to be required before starting a session.

## Verification Coverage

- [x] Add or extend UI smoke coverage for guide-click-during-stimulation behavior.
- [x] Add or extend UI smoke coverage for settings hotspot behavior while idle.
- [x] Add or extend UI smoke coverage for import/unlock after exporting during an active session.
