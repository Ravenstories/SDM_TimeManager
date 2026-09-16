# Daily workflow roadmap

## 1. Reliability foundation

Implemented guarded preferences, exact timestamp editing, stale-record guards,
note editor preservation, note-count/report-format fixes, build-derived versions
and explicit service-worker update controls. Added real-browser IndexedDB and
built-app smoke tests.

Validation: 24 unit tests, static build, and 2 Chromium browser tests passed.
Broader draft/reload handling and form-level conflict recovery are completed as
part of the daily editor controller in milestone 3.

## Remaining milestones

2. Configurable responsibilities and atomic v1 migration.
3. Daily timeline, correction, dated notes, long-session review, draft recovery.
4. Reports, exports, restore previews, release gates and acceptance coverage.
