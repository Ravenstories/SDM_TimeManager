# Initial validation

## Reporting and storage update

- `npm test`: 16 passing tests including reporting calendar boundaries, leap months, cross-month sessions, notes-only days, current running sessions, CSV totals, and backup timestamp validation.
- Real IndexedDB tests at `/tests/browser-storage.html`: 9 passing integration checks for legacy migration, concurrent writes, rollback, daily snapshots, restore snapshots, export metadata, retention bounds, and reopening without stale reimport. These use an isolated disposable database and are excluded from the deployed build.
- Browser UI: legacy records appeared in the upgraded app; monthly and yearly report totals matched them; the storage dialog showed protection status, export controls, and an honest empty recovery state.
- Build passed; no browser console warnings or errors during these checks.
- Cloud sync and browser-specific persistence permission grants were not configured or claimed as tested.

## Original baseline

- `npm test`: 11 passing tests covering exclusive switching, pause, reload/sleep elapsed time, midnight splitting, clock rollback, validation, long-duration formatting, local dates, serialized repository writes, corrupt data preservation, and storage failure propagation.
- `npm run build`: passed; only the app shell is copied to `dist/`.
- In-app browser: started VD, switched to SIT, saved a note, reloaded and verified running role and note persistence, paused, and opened compact view.
- Visually inspected desktop and 390 px mobile viewport; clocks and note controls remained usable.
- Browser console: no warning or error messages reported during those checks.

Real overnight sleep, offline startup, backup file restore, and every browser's install flow were not exercised manually. Sleep and midnight accounting were tested using deterministic timestamps. Test records exist only in the local preview browser, never in the source or deployed app.
