# Initial validation

- `npm test`: 11 passing tests covering exclusive switching, pause, reload/sleep elapsed time, midnight splitting, clock rollback, validation, long-duration formatting, local dates, serialized repository writes, corrupt data preservation, and storage failure propagation.
- `npm run build`: passed; only the app shell is copied to `dist/`.
- In-app browser: started VD, switched to SIT, saved a note, reloaded and verified running role and note persistence, paused, and opened compact view.
- Visually inspected desktop and 390 px mobile viewport; clocks and note controls remained usable.
- Browser console: no warning or error messages reported during those checks.

Real overnight sleep, offline startup, backup file restore, and every browser's install flow were not exercised manually. Sleep and midnight accounting were tested using deterministic timestamps. Test records exist only in the local preview browser, never in the source or deployed app.
