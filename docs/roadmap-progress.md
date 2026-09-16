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

## Remaining milestone

4. Reports, exports, restore previews, release gates and acceptance coverage.
