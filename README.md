# SDM Time Manager

A private, local-first count-up timer with configurable responsibilities, a daily
timeline, dated work notes, reporting and recovery. VD and SIT are editable
starting defaults. Exactly one responsibility runs at a time.

## Run and verify

Use Node.js 22 or later.

```sh
npm ci
npm start
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The development server opens at http://127.0.0.1:4173. Set `PORT` to use another
port, or `SITE_ROOT=dist` to serve the build. Browser tests serve an isolated
build on port 49168 with separate browser contexts. They do not touch your normal
browser's records. Two workers are used to avoid host resource contention.

The browser suite covers production IndexedDB, migration, transactions,
corrections, drafts, reports, restore, offline reopening, updates and responsive
controls. `tests/browser-storage.html` is also retained as a manual storage
harness for the development server. `npm run format` formats maintained sources.

## Daily use

- Start a responsibility, switch directly to another, or pause. The first three
  available responsibilities have timer cards and keyboard shortcuts 1–3.
  Additional responsibilities appear in the switcher. Space pauses.
- Shortcuts are ignored inside controls and dialogs. They are not global desktop
  shortcuts. Compact view keeps the timer and switching controls visible.
- The live timer always shows today. The daily review can show another date with
  its timeline, work/non-work totals, responsibility breakdown and notes.
- Add or correct completed entries directly from the timeline. Entries cannot
  overlap or end in the future. Unchanged timestamp fields keep their exact
  instant, including milliseconds and repeated daylight-saving hours.
- Use **Stop at…** to correct a running timer. A review appears after crossing
  midnight or reaching twelve hours; it never stops tracking automatically.
  **Keep tracking** dismisses review for that particular session.
- Notes have an explicit date, time and responsibility. New past-day notes
  default to noon. Notes and time-entry drafts survive reload and are kept
  separately per window; a new window can recover the latest unfinished draft.
  Save or explicitly cancel drafts before restoring data or applying an update.
- Concurrent record edits are rejected with reload/cancel recovery instead of
  silently overwriting newer values. Form controls lock while a save is pending.

## Responsibilities and history

Use **Responsibilities** to add, rename, reorder, classify, archive or restore
responsibilities. Names are trimmed, 1–40 characters and unique ignoring case.
IDs remain permanent; there is no permanent-delete action.

Renaming and reclassifying deliberately apply to the entire associated history.
The edit preview shows affected entries, notes and the work-total delta.
Archiving retains history and explicitly stops any running session atomically.

Work, non-work and total-tracked figures are separate. Work-share percentages use
work time as their denominator. Unresolved legacy time is identified separately.

## Reports and exports

Daily, weekly, monthly and yearly reports have responsibility filters and
previous/next period navigation. Weeks start Monday. Select a date to review it.
Reports show the timestamp through which running time is included.

- **Daily CSV v2:** rows per local day and responsibility, with permanent ID,
  current name, classification, decimal hours, calendar timezone and explicitly
  typed daily/period summary rows. Do not sum detail and summary rows together.
- **Sessions CSV v2:** exact UTC intervals, responsibility metadata, milliseconds,
  decimal hours and typed work/non-work/unresolved/tracked summary rows.
- **Legacy daily CSV:** original fixed columns; all responsibilities other than
  the original `vd` and `sit` IDs are grouped as Additional.
- **Legacy sessions CSV:** original four-column structure with current names.

CSV names are quoted and spreadsheet-formula prefixes neutralized. Display
rounding never changes stored durations.

## Storage, migration and backups

Records use IndexedDB. Display preferences and recoverable drafts use browser
storage separately; a preference failure does not block an existing database.
Records are not sent to GitHub, telemetry services or a backend.

State version 2 contains `responsibilities`, `sessions`, `notes`, `active` and
portable `preferences`. Entries reference `responsibilityId`; classification
is resolved from the current responsibility settings.

The database upgrades to version 2 to exclude older writers. v1 records migrate
atomically and their original state is retained as a recovery point. Close old
app windows when an upgrade is blocked. v1 backups remain accepted.

Configured additional-clock history inherits its last known name/classification.
If the configuration is missing, its history becomes archived **Legacy
additional**, with unresolved classification. Classify it explicitly. Names or
settings lost through prior reuse of the old extra slot cannot be reconstructed.

**Data & recovery** previews the backup date range, responsibilities, records and
replacement effects. Restore pauses an imported timer at its export timestamp,
preserves the current records atomically in a checkpoint, and restores portable
display preferences. A preview becomes stale if another tab changes records.

Up to 14 checkpoints are kept: before the first mutation each local day, before
restore, and during migration. They share the same browser storage as live data.
Export JSON regularly and retain the file outside this browser. Export status
records a download request, not proof that you kept the file.

There are no accounts or cloud synchronization. Moving between devices requires
a backup and replacement; it does not merge histories. Clearing browser data,
private browsing or device loss can remove local records. Browser storage
protection does not replace external backups.

## Clock and offline behavior

Elapsed time is reconstructed from timestamps across sleep, browser closure and
midnight. The app does not execute while the browser is closed. Device timezone
changes affect day boundaries; system-clock changes affect wall-clock accounting.
No idle detection, automatic stop, budgets or scoring are used.

The built shell is cached after the first online visit. Cache names are
build-derived and scoped to the installation path. An update notice provides an
explicit action after drafts are handled and other app windows close. Applying
an update does not erase IndexedDB records. Install/pin availability depends on
your browser.

## Architecture and delivery

- Pure rules: `domain.js`, `editing.js`, `reports.js`, `backup.js`.
- Persistence: `indexed-repository.js`; v1 parsing lives in `legacy-domain.js`.
- Focused views: responsibilities, notes, time entries, reports and recovery.
- `app.js` coordinates state, day selection, timers and cross-tab refreshes.
- `preferences.js` isolates optional browser-storage failures.
- `updates.js` and `sw.js` coordinate explicit offline-shell upgrades.

There are no runtime dependencies. Playwright and Prettier are development tools.
GitHub Actions verifies pull requests and main pushes, deploys main only after
passing checks, then runs a fresh browser smoke check against the published URL.
See [release notes](CHANGELOG.md) and [release checklist](docs/release-checklist.md).

Repository: https://github.com/Ravenstories/SDM_TimeManager

App: https://ravenstories.github.io/SDM_TimeManager/
