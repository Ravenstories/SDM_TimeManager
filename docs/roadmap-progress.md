# Daily workflow roadmap

## 1. Reliability foundation

Implemented guarded preferences, exact timestamp editing, stale-record guards,
note editor preservation, note-count/report-format fixes, build-derived versions
and explicit service-worker update controls. Added real-browser IndexedDB and
built-app smoke tests.

Validation: 24 unit tests, static build, and 2 Chromium browser tests passed.
Broader draft/reload handling and form-level conflict recovery are completed as
part of the daily editor controller in milestone 3.

## 2. Configurable responsibilities

Implemented v2 responsibility identities, retroactive names/classification,
archive/restore/reordering and a first-three timer layout with overflow switcher.
Migration preserves v1 originals in checkpoints and rejects older database opens.
Orphaned additional history stays unresolved and archived. Wired all view
controllers to responsibility IDs so migration has a usable complete interface.

Validation: 41 unit tests, static build, and 6 Chromium browser tests passed,
including migration, corrupt-record preservation, archive while tracking, and
overflow switching. Browser workers are bounded to two on this host.

## 3. Daily workflow

Completed the selected-day timeline, dated notes, active stop-at preview,
long-session review and per-session dismissal, compact preference, locally
recoverable note/time-entry drafts and explicit conflict reload/cancel actions.
Timestamp comparison also preserves the original instant in a repeated DST hour.

Validation: 41 unit tests and 13 Chromium browser checks passed, covering
millisecond edits, overlap rejection, historical note dates, draft reload,
concurrent note edits, blocked preference storage, active correction and atomic
rollback after a simulated storage failure.

## 4. Reports, recovery and release readiness

Completed shared work/non-work/unresolved totals, responsibility filters,
calendar navigation, typed v2 daily/session exports and legacy formats.
Restore previews include record counts, names, date range and timer treatment,
with stale-preview protection and a checkpoint before replacement.

Build versions and offline caches are installation-scoped. Explicit updates
respect unfinished edits and other windows. A save-in-flight race found during
update testing was fixed by locking forms while their transactions finish.
Draft copies are isolated by window so another tab cannot clear an unfinished
edit on reload.

Validation: 42 unit tests and 23 Chromium browser tests passed. Coverage includes
v1 upgrades, interrupted migration, blocked old connections, precise edits, DST,
multi-tab conflicts, restore, CSV totals, offline reopening, scoped updates,
keyboard focus, 390px layout and 200% CSS zoom. Desktop/mobile visual inspection
also completed. See release-checklist.md for platform validation limits.

Delivery is a review branch with four milestone commits. Production deployment
remains pending merge; local tests are not evidence of a live v2 deployment.
