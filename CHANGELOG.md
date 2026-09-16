# Release notes

## 2.0 — Daily workflow roadmap (pending merge and deployment)

- Configure, rename, reorder and archive all responsibilities. Historical
  classification and naming update intentionally with an impact preview.
- Review each day through a timeline, dated notes and consistent work/non-work
  totals. Correct running timers without automatic truncation.
- Preserve precise timestamps, recover drafts and detect concurrent edits.
- Preview backup replacement, retain migration/recovery snapshots and export
  responsibility-aware CSVs alongside legacy formats.
- See installed build versions and apply offline updates explicitly.
- Add pull-request verification and a deployed-browser smoke gate.

### Migration notice

The first open upgrades the local database to v2 and retains the original state
as a checkpoint. Close older app windows if prompted. Missing old additional-clock
settings require explicit classification. Export JSON before upgrading if you
want an external copy; never clear site data as an update workaround.

The old application cannot write the v2 database. If a release needs correction,
ship a forward-compatible fix retaining v2 support. Do not roll back to v1 code
over migrated databases.
